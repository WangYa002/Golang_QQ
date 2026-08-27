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
			// 直接替换注册表条目：注册请求可能乱序到达（StrictMode 双连接/重连），
			// 若在这里关闭"旧连接"，可能误杀真正存活的新连接。
			// 旧连接会在其 socket 关闭后自行 Unregister（有 cur==client 校验，不会误删）。
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
