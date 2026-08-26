package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"golang-qq/model"
)

func colByName(name string) *mongo.Collection {
	switch name {
	case "users":
		return model.Users
	case "conversations":
		return model.Conversations
	case "messages":
		return model.Messages
	case "groups":
		return model.Groups
	case "friend_requests":
		return model.FriendRequests
	case "friends":
		return model.Friends
	}
	return nil
}

// 分页参数：?page=1&page_size=20
func pagination(c *gin.Context) (skip, limit int64) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	return int64((page - 1) * size), int64(size)
}

func adminList(c *gin.Context, collection string, filter bson.M, items interface{}, page, pageSize int64, total *int64) bool {
	col := colByName(collection)
	if col == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid collection"})
		return false
	}
	*total, _ = col.CountDocuments(c, filter)
	opts := options.Find().SetSkip(page).SetLimit(pageSize).SetSort(bson.M{"created_at": -1})
	cursor, err := col.Find(c, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return false
	}
	defer cursor.Close(c)
	if err := cursor.All(c, items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return false
	}
	return true
}

// GET /api/admin/stats
func AdminStats(c *gin.Context) {
	count := func(name string, filter bson.M) int64 {
		n, _ := colByName(name).CountDocuments(c, filter)
		return n
	}
	online, _ := model.Users.CountDocuments(c, bson.M{"status": "online"})
	c.JSON(http.StatusOK, gin.H{
		"users":            count("users", bson.M{}),
		"conversations":    count("conversations", bson.M{}),
		"messages":         count("messages", bson.M{}),
		"groups":           count("groups", bson.M{}),
		"friends":          count("friends", bson.M{}),
		"friend_requests":  count("friend_requests", bson.M{}),
		"pending_requests": count("friend_requests", bson.M{"status": "pending"}),
		"online_users":     online,
	})
}

// GET /api/admin/users?page=&page_size=&q=
func AdminListUsers(c *gin.Context) {
	skip, limit := pagination(c)
	filter := bson.M{}
	if q := c.Query("q"); q != "" {
		regex := bson.M{"$regex": primitive.Regex{Pattern: q, Options: "i"}}
		filter["$or"] = []bson.M{{"username": regex}, {"nickname": regex}, {"email": regex}}
	}
	var items []model.User
	var total int64
	if !adminList(c, "users", filter, &items, skip, limit, &total) {
		return
	}
	// 脱敏：去掉密码
	pub := make([]model.UserPublic, 0, len(items))
	for _, u := range items {
		pub = append(pub, u.ToPublic())
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": pub})
}

// GET /api/admin/conversations
func AdminListConversations(c *gin.Context) {
	skip, limit := pagination(c)
	var items []model.Conversation
	var total int64
	if !adminList(c, "conversations", bson.M{}, &items, skip, limit, &total) {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": items})
}

// GET /api/admin/messages?q=（内容搜索）
func AdminListMessages(c *gin.Context) {
	skip, limit := pagination(c)
	filter := bson.M{}
	if q := c.Query("q"); q != "" {
		filter["content"] = bson.M{"$regex": primitive.Regex{Pattern: q, Options: "i"}}
	}
	var items []model.Message
	var total int64
	if !adminList(c, "messages", filter, &items, skip, limit, &total) {
		return
	}
	// 附带发送者昵称
	type row struct {
		model.Message
		SenderName string `json:"sender_name"`
	}
	rows := make([]row, 0, len(items))
	for _, m := range items {
		var u model.User
		name := ""
		if model.Users.FindOne(c, bson.M{"_id": m.SenderID}).Decode(&u) == nil {
			name = u.Nickname
			if name == "" {
				name = u.Username
			}
		}
		rows = append(rows, row{Message: m, SenderName: name})
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": rows})
}

// GET /api/admin/groups
func AdminListGroups(c *gin.Context) {
	skip, limit := pagination(c)
	var items []model.Group
	var total int64
	if !adminList(c, "groups", bson.M{}, &items, skip, limit, &total) {
		return
	}
	type row struct {
		model.Group
		MemberCount int    `json:"member_count"`
		OwnerName   string `json:"owner_name"`
	}
	rows := make([]row, 0, len(items))
	for _, g := range items {
		var owner model.User
		name := ""
		if model.Users.FindOne(c, bson.M{"_id": g.OwnerID}).Decode(&owner) == nil {
			name = owner.Nickname
			if name == "" {
				name = owner.Username
			}
		}
		rows = append(rows, row{Group: g, MemberCount: len(g.Members), OwnerName: name})
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": rows})
}

// GET /api/admin/friends
func AdminListFriends(c *gin.Context) {
	skip, limit := pagination(c)
	var items []model.Friend
	var total int64
	if !adminList(c, "friends", bson.M{}, &items, skip, limit, &total) {
		return
	}
	type row struct {
		model.Friend
		UserName   string `json:"user_name"`
		FriendName string `json:"friend_name"`
	}
	rows := make([]row, 0, len(items))
	nameOf := func(id primitive.ObjectID) string {
		var u model.User
		if model.Users.FindOne(c, bson.M{"_id": id}).Decode(&u) == nil {
			if u.Nickname != "" {
				return u.Nickname
			}
			return u.Username
		}
		return id.Hex()
	}
	for _, f := range items {
		rows = append(rows, row{Friend: f, UserName: nameOf(f.UserID), FriendName: nameOf(f.FriendID)})
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": rows})
}

// GET /api/admin/friend_requests
func AdminListFriendRequests(c *gin.Context) {
	skip, limit := pagination(c)
	var items []model.FriendRequest
	var total int64
	if !adminList(c, "friend_requests", bson.M{}, &items, skip, limit, &total) {
		return
	}
	type row struct {
		model.FriendRequest
		FromName string `json:"from_name"`
		ToName   string `json:"to_name"`
	}
	rows := make([]row, 0, len(items))
	nameOf := func(id primitive.ObjectID) string {
		var u model.User
		if model.Users.FindOne(c, bson.M{"_id": id}).Decode(&u) == nil {
			if u.Nickname != "" {
				return u.Nickname
			}
			return u.Username
		}
		return id.Hex()
	}
	for _, r := range items {
		rows = append(rows, row{FriendRequest: r, FromName: nameOf(r.FromUserID), ToName: nameOf(r.ToUserID)})
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	c.JSON(http.StatusOK, gin.H{"total": total, "page": page, "page_size": limit, "items": rows})
}
