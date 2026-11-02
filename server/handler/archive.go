package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"

	"golang-qq/archive"
	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/scheduler"
)

// AiArchiveBackfill 回填当前用户的历史消息到 RAG 聊天归档（存量数据）。
// POST /api/ai/archive/backfill
func AiArchiveBackfill(c *gin.Context) {
	userID := middleware.GetUserID(c)
	total := archive.Backfill(c.Request.Context(), userID)
	c.JSON(http.StatusOK, gin.H{"ok": true, "archived": total})
}

// AiPushTrigger 立即为当前用户生成并推送「小Q 早报」（演示/验证定时推送效果）。
// POST /api/ai/push/trigger
func AiPushTrigger(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var u struct {
		Nickname string `bson:"nickname"`
		Username string `bson:"username"`
	}
	name := ""
	if model.Users.FindOne(c.Request.Context(), bson.M{"_id": userID}).Decode(&u) == nil {
		name = u.Nickname
		if name == "" {
			name = u.Username
		}
	}
	summary, err := scheduler.PushDigest(c.Request.Context(), userID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "digest failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "summary": summary})
}
