package handler

import (
	"net/http"
	"regexp"
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

func GetUser(c *gin.Context) {
	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var user model.User
	err = model.Users.FindOne(c, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user.ToPublic())
}

type UpdateMeReq struct {
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Bio      string `json:"bio"`
	Email    string `json:"email"`
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
	if req.Bio != "" {
		update["bio"] = req.Bio
	}
	if req.Email != "" {
		update["email"] = req.Email
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

	// 同时按 username 和 nickname 模糊匹配（大小写不敏感）
	escaped := primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}
	filter := bson.M{
		"$or": []bson.M{
			{"username": escaped},
			{"nickname": escaped},
		},
	}

	cursor, err := model.Users.Find(c, filter)
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
