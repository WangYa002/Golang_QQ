package ws

import "go.mongodb.org/mongo-driver/bson/primitive"

type Hub struct {
	Clients    map[primitive.ObjectID]*Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *BroadcastMsg
}

type BroadcastMsg struct {
	TargetIDs []primitive.ObjectID
	Type      string
	Data      interface{}
}

var GlobalHub *Hub

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[primitive.ObjectID]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *BroadcastMsg, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			// 同一用户已有连接（断线重连 / 多标签页）→ 让旧连接的 WritePump 退出
			if old, ok := h.Clients[client.UserID]; ok {
				close(old.Send)
			}
			h.Clients[client.UserID] = client

		case client := <-h.Unregister:
			// 只移除"仍是当前注册连接"的条目，避免旧连接的注销误删新连接
			if cur, ok := h.Clients[client.UserID]; ok && cur == client {
				delete(h.Clients, client.UserID)
				close(client.Send)
			}

		case msg := <-h.Broadcast:
			if len(msg.TargetIDs) == 0 {
				for _, client := range h.Clients {
					client.Send <- msg
				}
			} else {
				for _, id := range msg.TargetIDs {
					if client, ok := h.Clients[id]; ok {
						client.Send <- msg
					}
				}
			}
		}
	}
}

func (h *Hub) IsOnline(userID primitive.ObjectID) bool {
	_, ok := h.Clients[userID]
	return ok
}
