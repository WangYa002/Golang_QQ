package ws

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
			h.Clients[client.UserID] = client

		case client := <-h.Unregister:
			if _, ok := h.Clients[client.UserID]; ok {
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
