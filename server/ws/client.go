package ws

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/model"
)

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan *BroadcastMsg
	UserID primitive.ObjectID
}

type WSMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ChatData struct {
	ConversationID string `json:"conversation_id"`
	Type           string `json:"type"`
	Content        string `json:"content"`
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

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()

		model.Users.UpdateByID(context.Background(), c.UserID, bson.M{
			"$set": bson.M{"status": "offline", "updated_at": time.Now()},
		})

		c.Hub.Broadcast <- &BroadcastMsg{
			TargetIDs: []primitive.ObjectID{},
			Type:      "user_offline",
			Data:      map[string]string{"user_id": c.UserID.Hex()},
		}
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
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
			c.Send <- &BroadcastMsg{Type: "heartbeat", Data: map[string]string{}}
		case "message_recall":
			c.handleRecall(msg.Data)
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

	convoID, err := primitive.ObjectIDFromHex(chat.ConversationID)
	if err != nil {
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)
	if err != nil {
		return
	}

	isMember := false
	for _, m := range convo.Members {
		if m == c.UserID {
			isMember = true
			break
		}
	}
	if !isMember {
		return
	}

	msg := model.Message{
		ID:             primitive.NewObjectID(),
		ConversationID: convoID,
		SenderID:       c.UserID,
		Type:           chat.Type,
		Content:        chat.Content,
		ReadBy:         []primitive.ObjectID{c.UserID},
		CreatedAt:      time.Now(),
	}

	_, err = model.Messages.InsertOne(context.Background(), msg)
	if err != nil {
		return
	}

	model.Conversations.UpdateByID(context.Background(), convoID, bson.M{
		"$set": bson.M{
			"last_message": model.LastMessage{
				Content:   chat.Content,
				SenderID:  c.UserID,
				Type:      chat.Type,
				CreatedAt: time.Now(),
			},
			"updated_at": time.Now(),
		},
	})

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "new_message",
		Data:      msg,
	}
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

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
