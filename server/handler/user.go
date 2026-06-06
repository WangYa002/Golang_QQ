package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/middleware"
	"golang-qq/model"
)

func GetMe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var user model.User
	err := model.Users.FindOne(c, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user.ToPublic())
}

type UpdateMeReq struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

func UpdateMe(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req UpdateMeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	update := bson.M{"updated_at": time.Now()}
	if req.Nickname != "" {
		update["nickname"] = req.Nickname
	}
	if req.Avatar != "" {
		update["avatar"] = req.Avatar
	}

	_, err := model.Users.UpdateByID(c, userID, bson.M{"$set": update})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func SearchUsers(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query required"})
		return
	}

	cursor, err := model.Users.Find(c, bson.M{"username": primitive.Regex{Pattern: q, Options: "i"}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}
	defer cursor.Close(c)

	var users []model.UserPublic
	for cursor.Next(c) {
		var u model.User
		cursor.Decode(&u)
		users = append(users, u.ToPublic())
	}

	c.JSON(http.StatusOK, users)
}
