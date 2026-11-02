package ws

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/cache"
	"golang-qq/model"
)

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan *BroadcastMsg
	UserID primitive.ObjectID
}

// Close 优雅关闭连接（用于单点登录顶号）：先发送关闭帧再关 socket，
// 触发 ReadPump 退出并 Unregister；若本连接已不是当前注册连接，
// Hub 不会广播 user_offline（由 Hub.Unregister 的 cur==client 校验保证）。
func (c *Client) Close() {
	c.Conn.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "logged in elsewhere"),
		time.Now().Add(writeWait))
	c.Conn.Close()
}

// trySend 非阻塞安全投递：缓冲满或 channel 已关闭时返回 false 并丢弃，
// 绝不阻塞调用方（用于后台 goroutine / 心跳，避免卡死或 panic）。
func (c *Client) trySend(msg *BroadcastMsg) (ok bool) {
	defer func() {
		if r := recover(); r != nil {
			ok = false // 向已关闭的 channel 发送 → 安全降级
		}
	}()
	select {
	case c.Send <- msg:
		return true
	default:
		return false
	}
}

type WSMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ChatData struct {
	ConversationID string                 `json:"conversation_id"`
	Type           string                 `json:"type"`
	Content        string                 `json:"content"`
	ClientMsgID    string                 `json:"client_msg_id"` // 客户端生成的唯一消息 ID，用于幂等去重
	Metadata       *model.MessageMetadata `json:"metadata,omitempty"`
}

type TypingData struct {
	ConversationID string `json:"conversation_id"`
}

type ReadData struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
}

type RecallData struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
}

type CallData struct {
	ConversationID string `json:"conversation_id"`
	CallType       string `json:"call_type"`
}

type CallEventData struct {
	ConversationID string          `json:"conversation_id"`
	CallID         string          `json:"call_id"`
	Kind           string          `json:"kind"` // accept | reject | hangup | signal
	Reason         string          `json:"reason"`
	Signal         json.RawMessage `json:"signal"`
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	// WebRTC SDP（视频通话 offer/answer 可达 6KB+）会超过默认 4KB 限制，
	// 超限后 gorilla/websocket 会直接关闭连接，导致信令丢失。放宽到 1MB。
	maxMessageSize = 1 << 20
)

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
		// 离线状态与 user_offline 广播由 Hub.Unregister 分支统一处理：
		// 仅在"被移除的连接仍是当前注册连接"时执行，避免被顶号/重连的旧连接误报下线。
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		// 收到 pong = 连接存活，续期 Redis 在线状态 TTL
		cache.KeepOnline(context.Background(), c.UserID.Hex())
		return nil
	})

	for {
		_, msgBytes, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "chat":
			c.handleChat(msg.Data)
		case "typing":
			c.handleTyping(msg.Data)
		case "read":
			c.handleRead(msg.Data)
		case "heartbeat":
			c.trySend(&BroadcastMsg{Type: "heartbeat", Data: map[string]string{}})
		case "message_recall":
			c.handleRecall(msg.Data)
		case "call":
			c.handleCall(msg.Data)
		case "call_event":
			c.handleCallEvent(msg.Data)
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, _ := json.Marshal(map[string]interface{}{
				"type": msg.Type,
				"data": msg.Data,
			})
			c.Conn.WriteMessage(websocket.TextMessage, data)

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleChat(data json.RawMessage) {
	var chat ChatData
	if err := json.Unmarshal(data, &chat); err != nil {
		return
	}
	// 与 HTTP 发送通路共用同一处理函数（幂等去重由 client_msg_id 保证）
	_ = SendChatMessage(c.Hub, c.UserID, chat)
}

func (c *Client) handleTyping(data json.RawMessage) {
	var typing TypingData
	if err := json.Unmarshal(data, &typing); err != nil {
		return
	}

	convoID, err := primitive.ObjectIDFromHex(typing.ConversationID)
	if err != nil {
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return
	}

	targets := make([]primitive.ObjectID, 0)
	for _, m := range convo.Members {
		if m != c.UserID {
			targets = append(targets, m)
		}
	}

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: targets,
		Type:      "typing",
		Data: map[string]string{
			"conversation_id": typing.ConversationID,
			"user_id":         c.UserID.Hex(),
		},
	}
}

func (c *Client) handleRead(data json.RawMessage) {
	var read ReadData
	if err := json.Unmarshal(data, &read); err != nil {
		return
	}

	msgID, err := primitive.ObjectIDFromHex(read.MessageID)
	if err != nil {
		return
	}

	model.Messages.UpdateByID(context.Background(), msgID, bson.M{
		"$addToSet": bson.M{"read_by": c.UserID},
	})

	convoID, _ := primitive.ObjectIDFromHex(read.ConversationID)
	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return
	}

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "read_receipt",
		Data: map[string]string{
			"conversation_id": read.ConversationID,
			"message_id":      read.MessageID,
			"user_id":         c.UserID.Hex(),
		},
	}
}

func (c *Client) handleRecall(data json.RawMessage) {
	var recall RecallData
	if err := json.Unmarshal(data, &recall); err != nil {
		return
	}

	convoID, err := primitive.ObjectIDFromHex(recall.ConversationID)
	if err != nil {
		return
	}
	msgID, err := primitive.ObjectIDFromHex(recall.MessageID)
	if err != nil {
		return
	}

	var msg model.Message
	err = model.Messages.FindOne(context.Background(), bson.M{"_id": msgID, "sender_id": c.UserID}).Decode(&msg)
	if err != nil {
		return
	}

	if time.Since(msg.CreatedAt) > 2*time.Minute {
		return
	}

	model.Messages.UpdateByID(context.Background(), msgID, bson.M{
		"$set": bson.M{"type": "recalled", "content": "该消息已撤回"},
	})

	var convo model.Conversation
	model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "message_recalled",
		Data: map[string]string{
			"conversation_id": recall.ConversationID,
			"message_id":      recall.MessageID,
		},
	}
}

// handleCall 发起通话：向会话中的其他成员广播 call_incoming
func (c *Client) handleCall(data json.RawMessage) {
	var call CallData
	if err := json.Unmarshal(data, &call); err != nil {
		return
	}
	if call.CallType != "voice" && call.CallType != "video" {
		return
	}

	convoID, err := primitive.ObjectIDFromHex(call.ConversationID)
	if err != nil {
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return
	}

	isMember := false
	targets := make([]primitive.ObjectID, 0)
	for _, m := range convo.Members {
		if m == c.UserID {
			isMember = true
		} else {
			targets = append(targets, m)
		}
	}
	if !isMember || len(targets) == 0 {
		return
	}

	var fromUser model.User
	model.Users.FindOne(context.Background(), bson.M{"_id": c.UserID}).Decode(&fromUser)

	// busy 判定收归服务端：被叫已有未结束通话 → 直接回拒，不依赖客户端状态
	callee := targets[0]
	if CallBusy(callee) || CallBusy(c.UserID) {
		c.Hub.Broadcast <- &BroadcastMsg{
			TargetIDs: []primitive.ObjectID{c.UserID},
			Type:      "call_rejected",
			Data: map[string]interface{}{
				"call_id":         "",
				"conversation_id": call.ConversationID,
				"reason":          "busy",
			},
		}
		return
	}

	callID := RegisterCall(convoID, c.UserID, callee)
	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: targets,
		Type:      "call_incoming",
		Data: map[string]interface{}{
			"call_id":         callID,
			"conversation_id": call.ConversationID,
			"call_type":       call.CallType,
			"from_user_id":    c.UserID.Hex(),
			"from_user":       fromUser.ToPublic(),
		},
	}
}

// handleCallEvent 通话过程中的事件中继：accept / reject / hangup / signal
func (c *Client) handleCallEvent(data json.RawMessage) {
	var evt CallEventData
	if err := json.Unmarshal(data, &evt); err != nil {
		return
	}

	convoID, err := primitive.ObjectIDFromHex(evt.ConversationID)
	if err != nil {
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return
	}

	targets := make([]primitive.ObjectID, 0)
	for _, m := range convo.Members {
		if m != c.UserID {
			targets = append(targets, m)
		}
	}
	if len(targets) == 0 {
		return
	}

	var msgType string
	switch evt.Kind {
	case "accept":
		msgType = "call_accepted"
		MarkAccepted(evt.CallID)
	case "reject":
		msgType = "call_rejected"
		FinishCall(evt.CallID)
	case "hangup":
		msgType = "call_ended"
		FinishCall(evt.CallID)
	case "signal":
		msgType = "call_signal"
	default:
		return
	}

	// accept/reject/hangup 广播给全体成员（含自己的其他设备）：
	// 多端在线时，未参与媒体的那台也能同步收线，避免僵尸振铃误拒后续来电
	if evt.Kind == "accept" || evt.Kind == "reject" || evt.Kind == "hangup" {
		targets = append(targets, c.UserID)
	}

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: targets,
		Type:      msgType,
		Data: map[string]interface{}{
			"call_id":         evt.CallID,
			"conversation_id": evt.ConversationID,
			"reason":          evt.Reason,
			"signal":          evt.Signal,
			"user_id":         c.UserID.Hex(),
		},
	}
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
