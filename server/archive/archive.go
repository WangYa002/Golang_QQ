package archive

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/model"
)

/**
 * 聊天记录归档：消息落库后异步写入 RAG 的个人聊天归档集合（接收者视角），
 * 支撑「谁给我发过简历」这类记忆型问答；检索命中可定位回原会话。
 */

var client = &http.Client{Timeout: 30 * time.Second}

func baseURL() string {
	if v := os.Getenv("RAG_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:8000"
}

type Record struct {
	OwnerID        string `json:"owner_id"`
	MessageID      string `json:"message_id"`
	ConversationID string `json:"conversation_id"`
	SenderName     string `json:"sender_name,omitempty"`
	MsgType        string `json:"msg_type"`
	ContentText    string `json:"content_text,omitempty"`
	FileName       string `json:"file_name,omitempty"`
	Ts             string `json:"ts"`
}

func ingest(records []Record) bool {
	body, _ := json.Marshal(map[string]any{"records": records})
	req, err := http.NewRequest(http.MethodPost, baseURL()+"/api/chat-archive/ingest", bytes.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[archive] ingest failed: %v", err)
		return false
	}
	resp.Body.Close()
	return true
}

// senderNames 批量取用户昵称（缺省回退用户名）。
func senderNames(ctx context.Context, ids []primitive.ObjectID) map[string]string {
	names := map[string]string{}
	for _, id := range ids {
		var u struct {
			Nickname string `bson:"nickname"`
			Username string `bson:"username"`
		}
		if err := model.Users.FindOne(ctx, bson.M{"_id": id}).Decode(&u); err == nil && (u.Nickname != "" || u.Username != "") {
			if u.Nickname != "" {
				names[id.Hex()] = u.Nickname
			} else {
				names[id.Hex()] = u.Username
			}
		}
	}
	return names
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

// Message 归档一条消息：对会话内每个接收成员生成一条「我收到的消息」记录。
// 文件/图片消息记录文件名（检索锚点），文本消息截断 200 字。异步执行，不阻塞发送链路。
func Message(convo model.Conversation, senderID primitive.ObjectID, msg model.Message) {
	records := BuildRecords(convo, senderID, msg, senderNames(context.Background(), []primitive.ObjectID{senderID}))
	if len(records) > 0 {
		go ingest(records)
	}
}

// BuildRecords 由一条消息构造各接收者的归档记录（Backfill 复用）。
func BuildRecords(convo model.Conversation, senderID primitive.ObjectID, msg model.Message, names map[string]string) []Record {
	switch msg.Type {
	case "system", "recalled":
		return nil
	}
	var text, fileName string
	if msg.Type == "image" || msg.Type == "file" {
		if msg.Metadata != nil {
			fileName = msg.Metadata.FileName
		}
	} else {
		text = clip(msg.Content, 200)
	}

	ts := msg.CreatedAt.UTC().Format("2006-01-02T15:04:05")
	name := names[senderID.Hex()]
	records := make([]Record, 0, len(convo.Members))
	for _, m := range convo.Members {
		if m.Hex() == msg.SenderID.Hex() {
			continue // 检索视角是「我收到的」，不归档自己发出的
		}
		records = append(records, Record{
			OwnerID:        m.Hex(),
			MessageID:      msg.ID.Hex(),
			ConversationID: convo.ID.Hex(),
			SenderName:     name,
			MsgType:        msg.Type,
			ContentText:    text,
			FileName:       fileName,
			Ts:             ts,
		})
	}
	return records
}

// Backfill 同步回填某用户的历史消息（存量数据），每会话最多 2000 条，返回归档条数。
func Backfill(ctx context.Context, userID primitive.ObjectID) int {
	cur, err := model.Conversations.Find(ctx, bson.M{"members": userID})
	if err != nil {
		return 0
	}
	var convos []model.Conversation
	cur.All(ctx, &convos)

	total := 0
	const batchSize = 200
	for _, convo := range convos {
		mcur, err := model.Messages.Find(ctx, bson.M{
			"conversation_id": convo.ID,
			"sender_id":       bson.M{"$ne": userID},
		})
		if err != nil {
			continue
		}
		var msgs []model.Message
		mcur.All(ctx, &msgs)
		if len(msgs) == 0 {
			continue
		}

		ids := make([]primitive.ObjectID, 0, 8)
		seen := map[string]bool{}
		for _, m := range msgs {
			if !seen[m.SenderID.Hex()] {
				seen[m.SenderID.Hex()] = true
				ids = append(ids, m.SenderID)
			}
		}
		names := senderNames(ctx, ids)

		batch := make([]Record, 0, batchSize)
		flush := func() {
			if len(batch) > 0 && ingest(batch) {
				total += len(batch)
			}
			batch = batch[:0]
		}
		for _, msg := range msgs {
			batch = append(batch, BuildRecords(convo, msg.SenderID, msg, names)...)
			if len(batch) >= batchSize {
				flush()
			}
		}
		flush()
	}
	return total
}
