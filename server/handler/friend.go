package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/middleware"
	"golang-qq/model"
	"golang-qq/ws"
)

type SendFriendRequestReq struct {
	ToUserID string `json:"to_user_id" binding:"required"`
	Message  string `json:"message"`
}

func SendFriendRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req SendFriendRequestReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	toID, err := primitive.ObjectIDFromHex(req.ToUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to_user_id"})
		return
	}

	if toID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot send to self"})
		return
	}

	var target model.User
	err = model.Users.FindOne(c, bson.M{"_id": toID}).Decode(&target)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	count, _ := model.Friends.CountDocuments(c, bson.M{
		"user_id":   userID,
		"friend_id": toID,
	})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "already friends"})
		return
	}

	count, _ = model.FriendRequests.CountDocuments(c, bson.M{
		"status": "pending",
		"$or": []bson.M{
			{"from_user_id": userID, "to_user_id": toID},
			{"from_user_id": toID, "to_user_id": userID},
		},
	})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "request already exists"})
		return
	}

	fr := model.FriendRequest{
		ID:         primitive.NewObjectID(),
		FromUserID: userID,
		ToUserID:   toID,
		Message:    req.Message,
		Status:     "pending",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	_, err = model.FriendRequests.InsertOne(c, fr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "send failed"})
		return
	}

	var fromUser model.User
	model.Users.FindOne(c, bson.M{"_id": userID}).Decode(&fromUser)
	ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
		TargetIDs: []primitive.ObjectID{toID},
		Type:      "friend_request",
		Data: map[string]interface{}{
			"id":        fr.ID,
			"from_user": fromUser.ToPublic(),
			"message":   req.Message,
		},
	}

	c.JSON(http.StatusCreated, gin.H{"id": fr.ID})
}

func GetFriendRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)

	cursor, err := model.FriendRequests.Find(c, bson.M{
		"to_user_id": userID,
		"status":     "pending",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(c)

	var results []model.FriendRequestPublic
	for cursor.Next(c) {
		var fr model.FriendRequest
		cursor.Decode(&fr)

		var fromUser model.User
		model.Users.FindOne(c, bson.M{"_id": fr.FromUserID}).Decode(&fromUser)

		results = append(results, model.FriendRequestPublic{
			ID:        fr.ID,
			FromUser:  fromUser.ToPublic(),
			ToUserID:  fr.ToUserID,
			Message:   fr.Message,
			Status:    fr.Status,
			CreatedAt: fr.CreatedAt,
		})
	}

	if results == nil {
		results = []model.FriendRequestPublic{}
	}
	c.JSON(http.StatusOK, results)
}

type HandleFriendRequestReq struct {
	Action string `json:"action" binding:"required"`
}

func HandleFriendRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	requestID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req HandleFriendRequestReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var fr model.FriendRequest
	err = model.FriendRequests.FindOne(c, bson.M{
		"_id":        requestID,
		"to_user_id": userID,
		"status":     "pending",
	}).Decode(&fr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}

	if req.Action == "accept" {
		now := time.Now()
		model.Friends.InsertOne(c, model.Friend{
			ID:        primitive.NewObjectID(),
			UserID:    fr.FromUserID,
			FriendID:  fr.ToUserID,
			CreatedAt: now,
		})
		model.Friends.InsertOne(c, model.Friend{
			ID:        primitive.NewObjectID(),
			UserID:    fr.ToUserID,
			FriendID:  fr.FromUserID,
			CreatedAt: now,
		})

		model.FriendRequests.UpdateByID(c, requestID, bson.M{
			"$set": bson.M{"status": "accepted", "updated_at": now},
		})

		var toUser model.User
		model.Users.FindOne(c, bson.M{"_id": userID}).Decode(&toUser)
		ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
			TargetIDs: []primitive.ObjectID{fr.FromUserID},
			Type:      "friend_accepted",
			Data:      toUser.ToPublic(),
		}

		c.JSON(http.StatusOK, gin.H{"message": "accepted"})
	} else if req.Action == "reject" {
		model.FriendRequests.UpdateByID(c, requestID, bson.M{
			"$set": bson.M{"status": "rejected", "updated_at": time.Now()},
		})
		c.JSON(http.StatusOK, gin.H{"message": "rejected"})
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid action"})
	}
}

func GetFriends(c *gin.Context) {
	userID := middleware.GetUserID(c)

	cursor, err := model.Friends.Find(c, bson.M{"user_id": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(c)

	var results []model.FriendPublic
	for cursor.Next(c) {
		var f model.Friend
		cursor.Decode(&f)

		var friend model.User
		model.Users.FindOne(c, bson.M{"_id": f.FriendID}).Decode(&friend)

		results = append(results, model.FriendPublic{
			ID:        f.ID,
			User:      friend.ToPublic(),
			Remark:    f.Remark,
			CreatedAt: f.CreatedAt,
		})
	}

	if results == nil {
		results = []model.FriendPublic{}
	}
	c.JSON(http.StatusOK, results)
}

func DeleteFriend(c *gin.Context) {
	userID := middleware.GetUserID(c)
	friendID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var f model.Friend
	err = model.Friends.FindOne(c, bson.M{"_id": friendID, "user_id": userID}).Decode(&f)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "friend not found"})
		return
	}

	model.Friends.DeleteMany(c, bson.M{
		"$or": []bson.M{
			{"user_id": userID, "friend_id": f.FriendID},
			{"user_id": f.FriendID, "friend_id": userID},
		},
	})

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

type UpdateRemarkReq struct {
	Remark string `json:"remark" binding:"required"`
}

func UpdateFriendRemark(c *gin.Context) {
	userID := middleware.GetUserID(c)
	friendID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req UpdateRemarkReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := model.Friends.UpdateOne(c,
		bson.M{"_id": friendID, "user_id": userID},
		bson.M{"$set": bson.M{"remark": req.Remark}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "friend not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
