package ws

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/archive"
	"golang-qq/cache"
	"golang-qq/model"
)

var (
	// ErrNotMember 发送者不是会话成员
	ErrNotMember = errors.New("sender is not a member of the conversation")
)

// SendChatMessage 处理一条聊天消息：校验会话成员、client_msg_id 幂等去重、落库、
// 更新会话摘要、广播给在线成员并为离线成员写离线队列。
// WS（handleChat）与 HTTP（POST /api/conversations/:id/messages）两条通路复用；
// WS 通路出错静默（与历史行为一致），HTTP 通路把错误返回给调用方。
func SendChatMessage(hub *Hub, senderID primitive.ObjectID, chat ChatData) error {
	convoID, err := primitive.ObjectIDFromHex(chat.ConversationID)
	if err != nil {
		return fmt.Errorf("invalid conversation id: %w", err)
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return fmt.Errorf("conversation not found: %w", err)
	}

	isMember := false
	for _, m := range convo.Members {
		if m == senderID {
			isMember = true
			break
		}
	}
	if !isMember {
		return ErrNotMember
	}

	msg := model.Message{
		ID:             primitive.NewObjectID(),
		ConversationID: convoID,
		SenderID:       senderID,
		Type:           chat.Type,
		Content:        chat.Content,
		Metadata:       chat.Metadata,
		ReadBy:         []primitive.ObjectID{senderID},
		CreatedAt:      time.Now(),
	}

	// 幂等去重：客户端重发/断线重连导致重复投递时，同一 client_msg_id 只落库一次
	if chat.ClientMsgID != "" {
		first, _ := cache.TryMarkMessage(context.Background(), chat.ClientMsgID)
		if !first {
			return nil // 重复消息，丢弃（视为成功）
		}
	}

	if _, err = model.Messages.InsertOne(context.Background(), msg); err != nil {
		return fmt.Errorf("insert message: %w", err)
	}

	model.Conversations.UpdateByID(context.Background(), convoID, bson.M{
		"$set": bson.M{
			"last_message": model.LastMessage{
				Content:   chat.Content,
				SenderID:  senderID,
				Type:      chat.Type,
				CreatedAt: time.Now(),
			},
			"updated_at": time.Now(),
		},
	})

	// 广播给在线成员；离线成员写入离线队列（Redis 缓冲，上线拉取）
	msgJSON, _ := json.Marshal(msg)
	for _, m := range convo.Members {
		if m == senderID {
			continue // 发送者自己不需离线缓存（前端本地已有）
		}
		// 会话 last_message/updated_at 已变，失效该成员的会话列表缓存
		cache.InvalidateConvoList(context.Background(), m.Hex())
		if cache.IsOnline(context.Background(), m.Hex()) {
			continue // 在线，由 Broadcast 推送
		}
		cache.PushOffline(context.Background(), m.Hex(), string(msgJSON))
	}
	// 发送者自己的会话列表缓存也失效（last_message 变化）
	cache.InvalidateConvoList(context.Background(), senderID.Hex())

	hub.Broadcast <- &BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "new_message",
		Data:      msg,
	}

	// 异步归档到 RAG 聊天记忆（接收者视角），支撑「谁给我发过 XX」检索
	archive.Message(convo, senderID, msg)
	return nil
}
