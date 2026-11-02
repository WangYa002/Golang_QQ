package scheduler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/model"
	"golang-qq/ws"
)

/**
 * 小Q 定时任务（Phase 1：主动推送）。
 * 每日 AI_PUSH_HOUR 点为所有用户生成「小Q 早报」：过去 24h 收到的消息/文件统计
 * 经 RAG LLM 摘要后，通过 WS ai_push 事件推给在线端。
 * 可经 POST /api/ai/push/trigger 为当前用户立即生成（演示/验证用）。
 */

var client = &http.Client{Timeout: 120 * time.Second}

func ragBase() string {
	if v := os.Getenv("RAG_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:8000"
}

func pushHour() int {
	if v := os.Getenv("AI_PUSH_HOUR"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 && n < 24 {
			return n
		}
	}
	return 9
}

// Start 启动定时循环（每分钟检查一次是否到达推送时刻）。
func Start() {
	go func() {
		log.Printf("[scheduler] started, daily push at %02d:00", pushHour())
		lastRun := ""
		for {
			time.Sleep(time.Minute)
			now := time.Now()
			key := now.Format("2006-01-02")
			if now.Hour() == pushHour() && lastRun != key {
				lastRun = key
				RunDailyPush()
			}
		}
	}()
}

// PushDigest 单用户日报：统计 → LLM 摘要 → WS ai_push。
func PushDigest(ctx context.Context, userID primitive.ObjectID, name string) (string, error) {
	since := time.Now().Add(-24 * time.Hour)

	// 该用户全部会话中 24h 内收到的消息
	ccur, err := model.Conversations.Find(ctx, bson.M{"members": userID})
	if err != nil {
		return "", err
	}
	var convos []model.Conversation
	ccur.All(ctx, &convos)
	var lines []string
	unread := 0
	for _, convo := range convos {
		mcur, err := model.Messages.Find(ctx, bson.M{
			"conversation_id": convo.ID,
			"sender_id":       bson.M{"$ne": userID},
			"created_at":      bson.M{"$gte": since},
		})
		if err != nil {
			continue
		}
		var msgs []model.Message
		mcur.All(ctx, &msgs)
		for _, m := range msgs {
			read := false
			for _, r := range m.ReadBy {
				if r == userID {
					read = true
					break
				}
			}
			if !read {
				unread++
			}
			desc := m.Content
			if (m.Type == "file" || m.Type == "image") && m.Metadata != nil && m.Metadata.FileName != "" {
				desc = "发送了文件《" + m.Metadata.FileName + "》"
			}
			if len([]rune(desc)) > 60 {
				desc = string([]rune(desc)[:60]) + "…"
			}
			lines = append(lines, fmt.Sprintf("- %s: %s", m.CreatedAt.Local().Format("15:04"), desc))
		}
	}
	contextText := fmt.Sprintf("用户「%s」过去 24 小时收到 %d 条消息（未读 %d 条）：\n", name, len(lines), unread)
	if len(lines) == 0 {
		contextText += "（无新消息）"
	} else {
		contextText += joinLines(lines)
	}

	// LLM 摘要
	summary := contextText
	body, _ := json.Marshal(map[string]string{"context": contextText})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ragBase()+"/api/digest", bytes.NewReader(body))
	if err == nil {
		req.Header.Set("Content-Type", "application/json")
		if resp, err := client.Do(req); err == nil {
			var out struct {
				Summary string `json:"summary"`
			}
			if json.NewDecoder(resp.Body).Decode(&out) == nil && out.Summary != "" {
				summary = out.Summary
			}
			resp.Body.Close()
		}
	}

	// WS 推送（在线端）
	ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
		TargetIDs: []primitive.ObjectID{userID},
		Type:      "ai_push",
		Data: map[string]string{
			"title":   "小Q 早报",
			"content": summary,
			"ts":      time.Now().Format(time.RFC3339),
		},
	}
	return summary, nil
}

func joinLines(lines []string) string {
	out := ""
	for i, l := range lines {
		if i > 0 {
			out += "\n"
		}
		out += l
	}
	return out
}

// RunDailyPush 为所有用户生成并推送日报。
func RunDailyPush() {
	ctx := context.Background()
	var users []struct {
		ID       primitive.ObjectID `bson:"_id"`
		Nickname string             `bson:"nickname"`
		Username string             `bson:"username"`
	}
	cur, err := model.Users.Find(ctx, bson.M{})
	if err != nil {
		return
	}
	cur.All(ctx, &users)
	n := 0
	for _, u := range users {
		name := u.Nickname
		if name == "" {
			name = u.Username
		}
		if _, err := PushDigest(ctx, u.ID, name); err == nil {
			n++
		}
	}
	log.Printf("[scheduler] daily push done for %d users", n)
}
