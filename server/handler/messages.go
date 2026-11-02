package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/ws"
)

type SendMessageReq struct {
	Type        string          `json:"type" binding:"required"`
	Content     string          `json:"content" binding:"required"`
	ClientMsgID string          `json:"client_msg_id" binding:"required"`
	Metadata    *model.MessageMetadata `json:"metadata,omitempty"`
}

// SendMessage HTTP 发送消息（WebSocket 断线时的兜底通道）。
// 与 WS 通路共用 ws.SendChatMessage：同样的成员校验、client_msg_id 幂等去重、
// 落库、会话摘要更新与广播。前端在 WS 未就绪时走此接口，消息不丢。
func SendMessage(c *gin.Context) {
	convoID := c.Param("id")
	userID := middleware.GetUserID(c)

	var req SendMessageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := ws.SendChatMessage(ws.GlobalHub, userID, ws.ChatData{
		ConversationID: convoID,
		Type:           req.Type,
		Content:        req.Content,
		ClientMsgID:    req.ClientMsgID,
		Metadata:       req.Metadata,
	})
	if err != nil {
		if errors.Is(err, ws.ErrNotMember) {
			c.JSON(http.StatusForbidden, gin.H{"error": "不是会话成员"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
