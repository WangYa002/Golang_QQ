package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:  func(r *http.Request) bool { return true },
	Subprotocols: []string{"access_token"},
}

func HandleWebSocket(c *gin.Context) {
	tokenStr := ""
	for _, sub := range websocket.Subprotocols(c.Request) {
		if sub != "" {
			tokenStr = sub
			break
		}
	}
	if tokenStr == "" {
		tokenStr = c.Query("token")
	}
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
		return
	}

	claims := &middleware.Claims{}
	token, err := middleware.ParseToken(tokenStr, claims)
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &ws.Client{
		Hub:    ws.GlobalHub,
		Conn:   conn,
		Send:   make(chan *ws.BroadcastMsg, 256),
		UserID: claims.UserID,
	}

	ws.GlobalHub.Register <- client

	model.Users.UpdateByID(c.Request.Context(), claims.UserID, bson.M{
		"$set": bson.M{"status": "online", "updated_at": time.Now()},
	})

	ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
		TargetIDs: []primitive.ObjectID{},
		Type:      "user_online",
		Data:      map[string]string{"user_id": claims.UserID.Hex()},
	}

	go client.WritePump()
	go client.ReadPump()
}
