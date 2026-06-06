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

type CreateGroupReq struct {
	Name      string   `json:"name" binding:"required"`
	Avatar    string   `json:"avatar"`
	MemberIDs []string `json:"member_ids"`
}

func CreateGroup(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req CreateGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	members := []model.GroupMember{
		{UserID: userID, Role: "owner", JoinedAt: time.Now()},
	}
	for _, mid := range req.MemberIDs {
		oid, err := primitive.ObjectIDFromHex(mid)
		if err != nil || oid == userID {
			continue
		}
		members = append(members, model.GroupMember{UserID: oid, Role: "member", JoinedAt: time.Now()})
	}

	group := model.Group{
		ID:         primitive.NewObjectID(),
		Name:       req.Name,
		Avatar:     req.Avatar,
		OwnerID:    userID,
		Members:    members,
		MaxMembers: 500,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	_, err := model.Groups.InsertOne(c, group)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create failed"})
		return
	}

	memberIDs := make([]primitive.ObjectID, 0, len(members))
	for _, m := range members {
		memberIDs = append(memberIDs, m.UserID)
	}
	convo := model.Conversation{
		ID:        primitive.NewObjectID(),
		Type:      "group",
		Members:   memberIDs,
		GroupID:   &group.ID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	model.Conversations.InsertOne(c, convo)

	c.JSON(http.StatusCreated, gin.H{"group": group, "conversation": convo})
}

func GetGroup(c *gin.Context) {
	groupID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var group model.Group
	err = model.Groups.FindOne(c, bson.M{"_id": groupID}).Decode(&group)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	c.JSON(http.StatusOK, group)
}

type AddMemberReq struct {
	UserID string `json:"user_id" binding:"required"`
}

func AddGroupMember(c *gin.Context) {
	groupID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID := middleware.GetUserID(c)

	var group model.Group
	err = model.Groups.FindOne(c, bson.M{"_id": groupID}).Decode(&group)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	isOwner := false
	for _, m := range group.Members {
		if m.UserID == userID && (m.Role == "owner" || m.Role == "admin") {
			isOwner = true
			break
		}
	}
	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "only owner or admin can add members"})
		return
	}

	var req AddMemberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newUserID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	member := model.GroupMember{UserID: newUserID, Role: "member", JoinedAt: time.Now()}
	_, err = model.Groups.UpdateByID(c, groupID, bson.M{
		"$push": bson.M{"members": member},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "add member failed"})
		return
	}

	model.Conversations.UpdateOne(c,
		bson.M{"group_id": groupID},
		bson.M{"$push": bson.M{"members": newUserID}},
	)

	c.JSON(http.StatusOK, gin.H{"message": "member added"})
}

func RemoveGroupMember(c *gin.Context) {
	groupID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	memberID, err := primitive.ObjectIDFromHex(c.Param("uid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uid"})
		return
	}

	userID := middleware.GetUserID(c)

	var group model.Group
	err = model.Groups.FindOne(c, bson.M{"_id": groupID}).Decode(&group)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	isOwner := false
	for _, m := range group.Members {
		if m.UserID == userID && (m.Role == "owner" || m.Role == "admin") {
			isOwner = true
			break
		}
	}
	if !isOwner && userID != memberID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only owner, admin, or self can remove member"})
		return
	}

	_, err = model.Groups.UpdateByID(c, groupID, bson.M{
		"$pull": bson.M{"members": bson.M{"user_id": memberID}},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "remove failed"})
		return
	}

	model.Conversations.UpdateOne(c,
		bson.M{"group_id": groupID},
		bson.M{"$pull": bson.M{"members": memberID}},
	)

	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}
