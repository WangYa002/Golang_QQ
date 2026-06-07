package handler

import (
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/ws"
)

func GetConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)

	opts := options.Find().SetSort(bson.M{"updated_at": -1})
	cursor, err := model.Conversations.Find(c, bson.M{"members": userID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(c)

	var convos []model.Conversation
	cursor.All(c, &convos)
	if convos == nil {
		convos = []model.Conversation{}
	}
	c.JSON(http.StatusOK, convos)
}

type CreateConvoReq struct {
	UserID string `json:"user_id" binding:"required"`
}

func CreateConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req CreateConvoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	otherID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	var existing model.Conversation
	err = model.Conversations.FindOne(c, bson.M{
		"type":    "private",
		"members": bson.M{"$all": []primitive.ObjectID{userID, otherID}},
	}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusOK, existing)
		return
	}

	convo := model.Conversation{
		ID:        primitive.NewObjectID(),
		Type:      "private",
		Members:   []primitive.ObjectID{userID, otherID},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = model.Conversations.InsertOne(c, convo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create failed"})
		return
	}

	c.JSON(http.StatusCreated, convo)
}

func GetMessages(c *gin.Context) {
	convoID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID := middleware.GetUserID(c)

	var convo model.Conversation
	err = model.Conversations.FindOne(c, bson.M{"_id": convoID, "members": userID}).Decode(&convo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "no access"})
		return
	}

	limit := int64(50)
	skip := int64(0)
	if s := c.Query("skip"); s != "" {
		skip, _ = strconv.ParseInt(s, 10, 64)
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1}).SetLimit(limit).SetSkip(skip)
	cursor, err := model.Messages.Find(c, bson.M{"conversation_id": convoID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(c)

	var messages []model.Message
	cursor.All(c, &messages)
	if messages == nil {
		messages = []model.Message{}
	}
	c.JSON(http.StatusOK, messages)
}

func RecallMessage(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convoID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation id"})
		return
	}
	msgID, err := primitive.ObjectIDFromHex(c.Param("mid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(c, bson.M{"_id": convoID, "members": userID}).Decode(&convo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "no access"})
		return
	}

	var msg model.Message
	err = model.Messages.FindOne(c, bson.M{"_id": msgID, "conversation_id": convoID}).Decode(&msg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	if msg.SenderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "can only recall own messages"})
		return
	}

	if time.Since(msg.CreatedAt) > 2*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only recall within 2 minutes"})
		return
	}

	model.Messages.UpdateByID(c, msgID, bson.M{
		"$set": bson.M{"type": "recalled", "content": "该消息已撤回"},
	})

	ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "message_recalled",
		Data: map[string]string{
			"conversation_id": convoID.Hex(),
			"message_id":      msgID.Hex(),
		},
	}

	c.JSON(http.StatusOK, gin.H{"message": "recalled"})
}

func SearchMessages(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convoID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var convo model.Conversation
	err = model.Conversations.FindOne(c, bson.M{"_id": convoID, "members": userID}).Decode(&convo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "no access"})
		return
	}

	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query required"})
		return
	}

	cursor, err := model.Messages.Find(c, bson.M{
		"conversation_id": convoID,
		"type":            bson.M{"$ne": "recalled"},
		"content":         primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}
	defer cursor.Close(c)

	var messages []model.Message
	cursor.All(c, &messages)
	if messages == nil {
		messages = []model.Message{}
	}
	c.JSON(http.StatusOK, messages)
}
