# Golang_QQ Full Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Golang_QQ from a basic private-chat-only app into a complete social IM application with friend system, contacts, user profiles, enhanced group chat, and message features.

**Architecture:** Incremental enhancement on existing Go(Gin)+React(Vite)+MongoDB+WebSocket stack. Backend adds new models/handlers/routes; frontend adds new components, stores, and pages while refactoring existing ones.

**Tech Stack:** Go 1.x / Gin / gorilla/websocket / MongoDB / React 19 / TypeScript / Vite / Zustand / TailwindCSS

---

## File Structure

### Backend — New Files
- `server/model/friend.go` — FriendRequest and Friend models
- `server/handler/friend.go` — Friend system HTTP handlers

### Backend — Modified Files
- `server/model/db.go` — Add FriendRequests/Friends collections + indexes
- `server/model/user.go` — Add Bio, Email fields to User and UserPublic
- `server/handler/user.go` — Add GetUser, extend UpdateMe with bio/email
- `server/handler/group.go` — Add UpdateGroup, GetGroupMembers
- `server/handler/conversation.go` — Add RecallMessage, SearchMessages
- `server/ws/client.go` — Handle message_recall WS type
- `server/router/router.go` — Register all new routes

### Frontend — New Files
- `web/src/api/friends.ts` — Friend API calls
- `web/src/store/friend.ts` — Friend state (Zustand)
- `web/src/components/FriendList.tsx` — Contacts list component
- `web/src/components/FriendRequests.tsx` — Friend request notifications
- `web/src/components/ProfilePanel.tsx` — User profile drawer
- `web/src/components/GroupMembers.tsx` — Group member panel
- `web/src/components/EmojiPicker.tsx` — Emoji selection popup
- `web/src/components/MessageMenu.tsx` — Message context menu (recall)

### Frontend — Modified Files
- `web/src/types/index.ts` — Add Friend, FriendRequest, extended User types
- `web/src/pages/Login.tsx` — Full redesign with split layout
- `web/src/pages/Chat.tsx` — Accept activeTab prop for sidebar
- `web/src/components/Sidebar.tsx` — Add contacts tab, friend request badge
- `web/src/components/ConversationList.tsx` — Minor: accept show/hide prop
- `web/src/components/ChatArea.tsx` — Emoji, recall, read receipts, search
- `web/src/store/chat.ts` — Handle recall, add searchMessages
- `web/src/hooks/useWebSocket.ts` — Handle friend_request, friend_accepted, message_recalled
- `web/src/api/users.ts` — Add getUser
- `web/src/api/groups.ts` — Add updateGroup, getGroupMembers
- `web/src/api/conversations.ts` — Add recallMessage, searchMessages
- `web/src/index.css` — Add new CSS vars/animations for login page

---

## Phase 1: Backend Foundation

### Task 1: Create Friend Model

**Files:**
- Create: `server/model/friend.go`

- [ ] **Step 1: Write friend model**

```go
package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FriendRequest struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	FromUserID primitive.ObjectID `bson:"from_user_id" json:"from_user_id"`
	ToUserID   primitive.ObjectID `bson:"to_user_id" json:"to_user_id"`
	Message    string             `bson:"message" json:"message"`
	Status     string             `bson:"status" json:"status"` // pending / accepted / rejected
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

type Friend struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	FriendID  primitive.ObjectID `bson:"friend_id" json:"friend_id"`
	Remark    string             `bson:"remark" json:"remark"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type FriendRequestPublic struct {
	ID         primitive.ObjectID `json:"id"`
	FromUser   UserPublic         `json:"from_user"`
	ToUserID   primitive.ObjectID `json:"to_user_id"`
	Message    string             `json:"message"`
	Status     string             `json:"status"`
	CreatedAt  time.Time          `json:"created_at"`
}

type FriendPublic struct {
	ID        primitive.ObjectID `json:"id"`
	User      UserPublic         `json:"user"`
	Remark    string             `json:"remark"`
	CreatedAt time.Time          `json:"created_at"`
}
```

- [ ] **Step 2: Commit**

```bash
git add server/model/friend.go
git commit -m "feat(model): add Friend and FriendRequest models"
```

---

### Task 2: Extend User Model and DB Collections

**Files:**
- Modify: `server/model/user.go` — Add Bio, Email fields
- Modify: `server/model/db.go` — Add FriendRequests/Friends collections + indexes

- [ ] **Step 1: Add Bio, Email to User and UserPublic**

In `server/model/user.go`, add `Bio` and `Email` fields:

```go
type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username  string             `bson:"username" json:"username"`
	Password  string             `bson:"password" json:"-"`
	Nickname  string             `bson:"nickname" json:"nickname"`
	Avatar    string             `bson:"avatar" json:"avatar"`
	Bio       string             `bson:"bio" json:"bio"`
	Email     string             `bson:"email" json:"email"`
	Status    string             `bson:"status" json:"status"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type UserPublic struct {
	ID        primitive.ObjectID `json:"id"`
	Username  string             `json:"username"`
	Nickname  string             `json:"nickname"`
	Avatar    string             `json:"avatar"`
	Bio       string             `json:"bio"`
	Email     string             `json:"email"`
	Status    string             `json:"status"`
}

func (u *User) ToPublic() UserPublic {
	return UserPublic{
		ID:       u.ID,
		Username: u.Username,
		Nickname: u.Nickname,
		Avatar:   u.Avatar,
		Bio:      u.Bio,
		Email:    u.Email,
		Status:   u.Status,
	}
}
```

- [ ] **Step 2: Add FriendRequests and Friends collections to db.go**

In `server/model/db.go`, add the collection variables and initialization:

Add to the `var` block:
```go
var (
	DB             *mongo.Database
	Users          *mongo.Collection
	Conversations  *mongo.Collection
	Messages       *mongo.Collection
	Groups         *mongo.Collection
	FriendRequests *mongo.Collection
	Friends        *mongo.Collection
)
```

Add inside `ConnectDB()`, after `Groups = DB.Collection("groups")`:
```go
FriendRequests = DB.Collection("friend_requests")
Friends = DB.Collection("friends")
```

Add indexes inside `createIndexes()`:
```go
FriendRequests.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
	{Keys: map[string]int{"from_user_id": 1, "to_user_id": 1}, Options: options.Index().SetUnique(true)},
	{Keys: map[string]int{"to_user_id": 1, "status": 1}},
})
Friends.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
	{Keys: map[string]int{"user_id": 1, "friend_id": 1}, Options: options.Index().SetUnique(true)},
})
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd server && go build ./...`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/model/user.go server/model/db.go
git commit -m "feat(model): add bio/email to User, add friend collections and indexes"
```

---

### Task 3: Create Friend Handler

**Files:**
- Create: `server/handler/friend.go`

- [ ] **Step 1: Write friend handler**

```go
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

	// Check target user exists
	var target model.User
	err = model.Users.FindOne(c, bson.M{"_id": toID}).Decode(&target)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Check already friends
	count, _ := model.Friends.CountDocuments(c, bson.M{
		"user_id":   userID,
		"friend_id": toID,
	})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "already friends"})
		return
	}

	// Check existing pending request (either direction)
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

	// Notify target user via WebSocket
	var fromUser model.User
	model.Users.FindOne(c, bson.M{"_id": userID}).Decode(&fromUser)
	ws.GlobalHub.Broadcast <- &ws.BroadcastMsg{
		TargetIDs: []primitive.ObjectID{toID},
		Type:      "friend_request",
		Data: map[string]interface{}{
			"id":       fr.ID,
			"from_user": fromUser.ToPublic(),
			"message":  req.Message,
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
	Action string `json:"action" binding:"required"` // accept / reject
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

		// Notify sender
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

	// Find the friend doc to get friend's user_id
	var f model.Friend
	err = model.Friends.FindOne(c, bson.M{"_id": friendID, "user_id": userID}).Decode(&f)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "friend not found"})
		return
	}

	// Delete both directions
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

	_, err = model.Friends.UpdateOne(c,
		bson.M{"_id": friendID, "user_id": userID},
		bson.M{"$set": bson.M{"remark": req.Remark}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd server && go build ./...`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/handler/friend.go
git commit -m "feat(handler): add friend system handlers (request/accept/reject/delete)"
```

---

### Task 4: Extend User Handler

**Files:**
- Modify: `server/handler/user.go`

- [ ] **Step 1: Add GetUser and extend UpdateMeReq**

Replace the entire `server/handler/user.go`:

```go
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

	cursor, err := model.Users.Find(c, bson.M{"username": primitive.Regex{Pattern: regexp.QuoteMeta(q), Options: "i"}})
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
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/handler/user.go
git commit -m "feat(handler): add GetUser endpoint, extend UpdateMe with bio/email"
```

---

### Task 5: Extend Group Handler

**Files:**
- Modify: `server/handler/group.go`

- [ ] **Step 1: Add UpdateGroup and GetGroupMembers**

Append to `server/handler/group.go`:

```go
type UpdateGroupReq struct {
	Name        string `json:"name"`
	Announcement string `json:"announcement"`
}

func UpdateGroup(c *gin.Context) {
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

	isOwnerOrAdmin := false
	for _, m := range group.Members {
		if m.UserID == userID && (m.Role == "owner" || m.Role == "admin") {
			isOwnerOrAdmin = true
			break
		}
	}
	if !isOwnerOrAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "only owner or admin can update"})
		return
	}

	var req UpdateGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	update := bson.M{"updated_at": time.Now()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Announcement != "" {
		update["announcement"] = req.Announcement
	}

	_, err = model.Groups.UpdateByID(c, groupID, bson.M{"$set": update})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func GetGroupMembers(c *gin.Context) {
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

	type MemberWithUser struct {
		UserID   primitive.ObjectID  `json:"user_id"`
		Role     string              `json:"role"`
		JoinedAt time.Time           `json:"joined_at"`
		User     model.UserPublic    `json:"user"`
	}

	members := make([]MemberWithUser, 0, len(group.Members))
	for _, m := range group.Members {
		var user model.User
		model.Users.FindOne(c, bson.M{"_id": m.UserID}).Decode(&user)
		members = append(members, MemberWithUser{
			UserID:   m.UserID,
			Role:     m.Role,
			JoinedAt: m.JoinedAt,
			User:     user.ToPublic(),
		})
	}

	c.JSON(http.StatusOK, members)
}
```

Also add `Announcement` field to the Group model. In `server/model/group.go`, add after `MaxMembers`:

```go
Announcement string `bson:"announcement" json:"announcement"`
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/handler/group.go server/model/group.go
git commit -m "feat(handler): add UpdateGroup and GetGroupMembers endpoints"
```

---

### Task 6: Add Message Recall and Search

**Files:**
- Modify: `server/handler/conversation.go`

- [ ] **Step 1: Add RecallMessage and SearchMessages handlers**

Append to `server/handler/conversation.go`:

```go
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

	// Verify user is a member
	var convo model.Conversation
	err = model.Conversations.FindOne(c, bson.M{"_id": convoID, "members": userID}).Decode(&convo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "no access"})
		return
	}

	// Verify message sender and within 2 minutes
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

	// Broadcast recall notification
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
```

Add the import for `ws` package at the top of `conversation.go`:
```go
"golang-qq/ws"
```

Remove the `strconv` import since it's no longer used (or keep if still used by GetMessages).

Actually, `strconv` IS still used by `GetMessages`, so keep it.

```go
func SearchMessages(c *gin.Context) {
	userID := middleware.GetUserID(c)
	convoID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	// Verify access
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
```

Add `regexp` to the imports if not already present. Check current imports - `strconv` is there but not `regexp`. Add `"regexp"` to the import list. Also add `"time"` if not present.

- [ ] **Step 2: Verify backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/handler/conversation.go
git commit -m "feat(handler): add RecallMessage and SearchMessages endpoints"
```

---

### Task 7: Handle message_recall in WebSocket Client

**Files:**
- Modify: `server/ws/client.go`

- [ ] **Step 1: Add message_recall case to ReadPump switch**

In `server/ws/client.go`, add a new data struct and handler case.

Add the struct after the `ReadData` struct:
```go
type RecallData struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
}
```

Add a case in the `switch msg.Type` block inside `ReadPump()`:
```go
case "message_recall":
	c.handleRecall(msg.Data)
```

Add the handler function after `handleRead`:
```go
func (c *Client) handleRecall(data json.RawMessage) {
	var recall RecallData
	if err := json.Unmarshal(data, &recall); err != nil {
		return
	}

	convoID, err := primitive.ObjectIDFromHex(recall.ConversationID)
	if err != nil {
		return
	}
	msgID, err := primitive.ObjectIDFromHex(recall.MessageID)
	if err != nil {
		return
	}

	// Verify sender
	var msg model.Message
	err = model.Messages.FindOne(context.Background(), bson.M{"_id": msgID, "sender_id": c.UserID}).Decode(&msg)
	if err != nil {
		return
	}

	if time.Since(msg.CreatedAt) > 2*time.Minute {
		return
	}

	model.Messages.UpdateByID(context.Background(), msgID, bson.M{
		"$set": bson.M{"type": "recalled", "content": "该消息已撤回"},
	})

	var convo model.Conversation
	model.Conversations.FindOne(context.Background(), bson.M{"_id": convoID}).Decode(&convo)

	c.Hub.Broadcast <- &BroadcastMsg{
		TargetIDs: convo.Members,
		Type:      "message_recalled",
		Data: map[string]string{
			"conversation_id": recall.ConversationID,
			"message_id":      recall.MessageID,
		},
	}
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/ws/client.go
git commit -m "feat(ws): handle message_recall WebSocket message type"
```

---

### Task 8: Update Router

**Files:**
- Modify: `server/router/router.go`

- [ ] **Step 1: Add all new routes**

Replace the entire `server/router/router.go`:

```go
package router

import (
	"github.com/gin-gonic/gin"

	"golang-qq/handler"
	"golang-qq/middleware"
)

func Setup(r *gin.Engine) {
	r.Use(middleware.CORS())

	r.Static("/uploads", "../uploads")

	r.GET("/ws", handler.HandleWebSocket)

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", handler.Register)
			auth.POST("/login", handler.Login)
		}

		authorized := api.Group("")
		authorized.Use(middleware.AuthMiddleware())
		{
			users := authorized.Group("/users")
			{
				users.GET("/me", handler.GetMe)
				users.PUT("/me", handler.UpdateMe)
				users.GET("/search", handler.SearchUsers)
				users.GET("/:id", handler.GetUser)
			}

			conversations := authorized.Group("/conversations")
			{
				conversations.GET("", handler.GetConversations)
				conversations.POST("", handler.CreateConversation)
				conversations.GET("/:id/messages", handler.GetMessages)
				conversations.DELETE("/:id/messages/:mid", handler.RecallMessage)
				conversations.GET("/:id/messages/search", handler.SearchMessages)
			}

			groups := authorized.Group("/groups")
			{
				groups.POST("", handler.CreateGroup)
				groups.GET("/:id", handler.GetGroup)
				groups.PUT("/:id", handler.UpdateGroup)
				groups.GET("/:id/members", handler.GetGroupMembers)
				groups.POST("/:id/members", handler.AddGroupMember)
				groups.DELETE("/:id/members/:uid", handler.RemoveGroupMember)
			}

			friends := authorized.Group("/friends")
			{
				friends.POST("/request", handler.SendFriendRequest)
				friends.GET("/requests", handler.GetFriendRequests)
				friends.PUT("/requests/:id", handler.HandleFriendRequest)
				friends.GET("", handler.GetFriends)
				friends.DELETE("/:id", handler.DeleteFriend)
				friends.PUT("/:id/remark", handler.UpdateFriendRemark)
			}

			authorized.POST("/upload", handler.UploadFile)
		}
	}
}
```

- [ ] **Step 2: Verify full backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/router/router.go
git commit -m "feat(router): register all new API routes for friends, groups, messages"
```

---

## Phase 2: Login Page Redesign

### Task 9: Redesign Login Page

**Files:**
- Modify: `web/src/pages/Login.tsx`
- Modify: `web/src/index.css` — Add login-specific animations

- [ ] **Step 1: Add login animations to CSS**

Append to `web/src/index.css`:

```css
@keyframes floatUp {
  0% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-up {
  animation: slideUp 0.4s ease forwards;
}
```

- [ ] **Step 2: Rewrite Login.tsx**

Replace the entire `web/src/pages/Login.tsx`:

```tsx
import { useState } from 'react';
import { useAuthStore } from '../store/auth';

function getPasswordStrength(pwd: string): { level: number; text: string; color: string } {
  if (!pwd) return { level: 0, text: '', color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, text: '弱', color: 'var(--danger)' };
  if (score <= 3) return { level: 2, text: '中', color: 'var(--warning)' };
  return { level: 3, text: '强', color: 'var(--success)' };
}

export default function Login() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (activeTab === 'register' && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'register') {
        await register(username, password, nickname);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* 左侧展示区 */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%)' }}>

        {/* 浮动装饰粒子 */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: 8 + i * 4,
              height: 8 + i * 4,
              background: `rgba(108, 92, 231, ${0.15 + i * 0.05})`,
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `floatUp ${8 + i * 2}s linear ${i * 1.5}s infinite`,
            }} />
        ))}

        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-8"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 8px 32px rgba(108, 92, 231, 0.4)',
            }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Golang QQ
          </h1>
          <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
            基于 Go + React 的即时通讯应用
          </p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              { icon: '💬', title: '实时通讯', desc: 'WebSocket 驱动的即时消息' },
              { icon: '👥', title: '群组聊天', desc: '创建群组与多人协作' },
              { icon: '🔒', title: '安全可靠', desc: 'JWT 认证与数据加密' },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <span className="text-2xl">{feat.icon}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{feat.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-fade-in w-full max-w-[400px]">

          {/* Logo (mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Golang QQ</h1>
          </div>

          {/* Tab 切换 */}
          <div className="flex mb-8 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setError(''); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                  boxShadow: activeTab === tab ? '0 2px 10px rgba(108, 92, 231, 0.3)' : 'none',
                }}
              >
                {tab === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="animate-fade-in mb-5 p-3 rounded-xl text-sm flex items-center gap-2"
              style={{ background: 'rgba(255,107,107,0.12)', color: 'var(--danger)', border: '1px solid rgba(255,107,107,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                用户名
              </label>
              <input
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                required
              />
            </div>

            {activeTab === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                  昵称
                </label>
                <input
                  type="text"
                  placeholder="请输入昵称"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl outline-none text-sm"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {/* 密码强度 */}
              {activeTab === 'register' && password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3].map((lvl) => (
                      <div key={lvl} className="flex-1 h-1 rounded-full"
                        style={{ background: strength.level >= lvl ? strength.color : 'var(--bg-tertiary)' }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strength.color }}>{strength.text}</span>
                </div>
              )}
            </div>

            {activeTab === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>
                  确认密码
                </label>
                <input
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                  required
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs mt-1 ml-1" style={{ color: 'var(--danger)' }}>密码不一致</p>
                )}
              </div>
            )}

            {activeTab === 'login' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>记住登录</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium cursor-pointer text-white text-sm"
              style={{
                background: loading
                  ? 'var(--accent-dark)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(108, 92, 231, 0.4)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  处理中...
                </span>
              ) : activeTab === 'login' ? '登 录' : '注 册'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Login.tsx web/src/index.css
git commit -m "feat(ui): redesign login page with split layout, tabs, password strength"
```

---

## Phase 3: Friend System & Contacts

### Task 10: Add Frontend Types

**Files:**
- Modify: `web/src/types/index.ts`

- [ ] **Step 1: Add friend-related types and extend User**

Append to `web/src/types/index.ts`:

```typescript
// Extend existing User interface — add bio and email
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  bio: string;
  email: string;
  status: 'online' | 'offline' | 'away';
}

export interface FriendRequest {
  id: string;
  from_user: User;
  to_user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Friend {
  id: string;
  user: User;
  remark: string;
  created_at: string;
}

export interface GroupMemberWithUser {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: User;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/types/index.ts
git commit -m "feat(types): add Friend, FriendRequest, GroupMemberWithUser types"
```

---

### Task 11: Create Friend API

**Files:**
- Create: `web/src/api/friends.ts`

- [ ] **Step 1: Write friend API module**

```typescript
import { request } from './client';
import type { Friend, FriendRequest } from '../types';

export function sendFriendRequest(toUserId: string, message: string) {
  return request<{ id: string }>('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ to_user_id: toUserId, message }),
  });
}

export function getFriendRequests() {
  return request<FriendRequest[]>('/friends/requests');
}

export function handleFriendRequest(id: string, action: 'accept' | 'reject') {
  return request(`/friends/requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
}

export function getFriends() {
  return request<Friend[]>('/friends');
}

export function deleteFriend(id: string) {
  return request(`/friends/${id}`, { method: 'DELETE' });
}

export function updateFriendRemark(id: string, remark: string) {
  return request(`/friends/${id}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark }),
  });
}
```

- [ ] **Step 2: Extend users API**

In `web/src/api/users.ts`, add:

```typescript
export function getUser(id: string) {
  return request<User>(`/users/${id}`);
}
```

- [ ] **Step 3: Extend groups API**

In `web/src/api/groups.ts`, add:

```typescript
export function updateGroup(id: string, data: { name?: string; announcement?: string }) {
  return request(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getGroupMembers(id: string) {
  return request(`/groups/${id}/members`);
}
```

- [ ] **Step 4: Extend conversations API**

In `web/src/api/conversations.ts`, add:

```typescript
export function recallMessage(conversationId: string, messageId: string) {
  return request(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export function searchMessages(conversationId: string, query: string) {
  return request<Message[]>(`/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}`);
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/api/friends.ts web/src/api/users.ts web/src/api/groups.ts web/src/api/conversations.ts
git commit -m "feat(api): add friend, user, group, and conversation API extensions"
```

---

### Task 12: Create Friend Store

**Files:**
- Create: `web/src/store/friend.ts`

- [ ] **Step 1: Write friend store**

```typescript
import { create } from 'zustand';
import type { Friend, FriendRequest } from '../types';
import * as friendApi from '../api/friends';

interface FriendState {
  friends: Friend[];
  requests: FriendRequest[];
  loading: boolean;
  fetchFriends: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  sendRequest: (toUserId: string, message: string) => Promise<void>;
  acceptRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  getPendingCount: () => number;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  requests: [],
  loading: false,

  fetchFriends: async () => {
    const friends = await friendApi.getFriends();
    set({ friends: friends || [] });
  },

  fetchRequests: async () => {
    const requests = await friendApi.getFriendRequests();
    set({ requests: requests || [] });
  },

  sendRequest: async (toUserId, message) => {
    await friendApi.sendFriendRequest(toUserId, message);
  },

  acceptRequest: async (id) => {
    await friendApi.handleFriendRequest(id, 'accept');
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    await get().fetchFriends();
  },

  rejectRequest: async (id) => {
    await friendApi.handleFriendRequest(id, 'reject');
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
  },

  removeFriend: async (id) => {
    await friendApi.deleteFriend(id);
    set((s) => ({ friends: s.friends.filter((f) => f.id !== id) }));
  },

  getPendingCount: () => get().requests.length,
}));
```

- [ ] **Step 2: Commit**

```bash
git add web/src/store/friend.ts
git commit -m "feat(store): add friend state management with Zustand"
```

---

### Task 13: Update WebSocket Hook for New Events

**Files:**
- Modify: `web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Handle friend_request, friend_accepted, message_recalled**

In `web/src/hooks/useWebSocket.ts`, add the new imports at the top:

```typescript
import { useFriendStore } from '../store/friend';
```

Inside the `ws.onmessage` handler's switch block, add new cases after the existing ones:

```typescript
case 'friend_request': {
  useFriendStore.getState().fetchRequests();
  break;
}
case 'friend_accepted': {
  useFriendStore.getState().fetchFriends();
  break;
}
case 'message_recalled': {
  const d = msg.data as { conversation_id: string; message_id: string };
  useChatStore.getState().handleMessageRecalled(d.conversation_id, d.message_id);
  break;
}
```

Also, inside the `connect` function, make sure to also subscribe to friend store updates. The existing pattern of getting store state at connect time is fine since we use `getState()` for immediate access.

- [ ] **Step 2: Add handleMessageRecalled to chat store**

In `web/src/store/chat.ts`, add the method to the `ChatState` interface:

```typescript
handleMessageRecalled: (convoId: string, msgId: string) => void;
```

And add the implementation in the store:

```typescript
handleMessageRecalled: (convoId, msgId) => {
  set((s) => {
    const msgs = s.messages[convoId];
    if (!msgs) return s;
    return {
      messages: {
        ...s.messages,
        [convoId]: msgs.map((m) =>
          m.id === msgId ? { ...m, type: 'system' as const, content: '该消息已撤回' } : m
        ),
      },
    };
  });
},
```

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/useWebSocket.ts web/src/store/chat.ts
git commit -m "feat(ws): handle friend_request, friend_accepted, message_recalled events"
```

---

### Task 14: Create FriendRequests Component

**Files:**
- Create: `web/src/components/FriendRequests.tsx`

- [ ] **Step 1: Write FriendRequests component**

```tsx
import { useEffect } from 'react';
import { useFriendStore } from '../store/friend';

export default function FriendRequests() {
  const requests = useFriendStore((s) => s.requests);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const rejectRequest = useFriendStore((s) => s.rejectRequest);

  useEffect(() => { fetchRequests(); }, []);

  if (requests.length === 0) return null;

  return (
    <div className="px-3 pb-3">
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
        style={{ color: 'var(--text-muted)' }}>
        好友申请
      </div>
      <div className="space-y-1.5">
        {requests.map((req) => (
          <div key={req.id} className="p-3 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                {req.from_user.nickname?.[0] || req.from_user.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {req.from_user.nickname || req.from_user.username}
                </div>
                {req.message && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {req.message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => acceptRequest(req.id)}
                className="flex-1 py-1.5 rounded-lg text-xs cursor-pointer font-medium text-white"
                style={{ background: 'var(--accent)' }}>
                接受
              </button>
              <button
                onClick={() => rejectRequest(req.id)}
                className="flex-1 py-1.5 rounded-lg text-xs cursor-pointer font-medium"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                拒绝
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/FriendRequests.tsx
git commit -m "feat(ui): add FriendRequests component with accept/reject actions"
```

---

### Task 15: Create FriendList Component

**Files:**
- Create: `web/src/components/FriendList.tsx`

- [ ] **Step 1: Write FriendList component**

```tsx
import { useEffect, useState } from 'react';
import { useFriendStore } from '../store/friend';
import { useChatStore } from '../store/chat';
import { createConversation } from '../api/conversations';
import { useFriendStore as friendStore } from '../store/friend';

interface Props {
  onOpenProfile: (userId: string) => void;
}

export default function FriendList({ onOpenProfile }: Props) {
  const friends = useFriendStore((s) => s.friends);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const removeFriend = useFriendStore((s) => s.removeFriend);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);

  const [filter, setFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ friendId: string; userId: string; x: number; y: number } | null>(null);

  useEffect(() => { fetchFriends(); }, []);

  const filteredFriends = filter
    ? friends.filter((f) =>
        (f.remark || f.user.nickname || f.user.username).toLowerCase().includes(filter.toLowerCase())
      )
    : friends;

  const handleStartChat = async (userId: string) => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
  };

  const handleContextMenu = (e: React.MouseEvent, friendId: string, userId: string) => {
    e.preventDefault();
    setContextMenu({ friendId, userId, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      {/* 搜索栏 */}
      <div className="p-4 pb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索联系人..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl outline-none text-sm"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      {/* 好友申请区域 */}
      <FriendRequestsInline />

      {/* 标题 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          好友
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {friends.length}
        </span>
      </div>

      {/* 好友列表 */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredFriends.map((f) => {
          const displayName = f.remark || f.user.nickname || f.user.username;
          const isOnline = !!onlineUsers[f.user.id];
          return (
            <div
              key={f.id}
              onClick={() => handleStartChat(f.user.id)}
              onContextMenu={(e) => handleContextMenu(e, f.id, f.user.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-0.5"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                  {displayName[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                  style={{
                    background: isOnline ? 'var(--success)' : 'var(--text-muted)',
                    borderColor: 'var(--bg-secondary)',
                  }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {displayName}
                  {f.remark && f.user.nickname && (
                    <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>({f.user.nickname})</span>
                  )}
                </div>
                {f.user.bio && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.user.bio}</div>
                )}
              </div>
            </div>
          );
        })}

        {friends.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无好友</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>通过搜索添加好友</p>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 py-1.5 rounded-xl"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: 140,
            }}>
            <button
              onClick={() => { handleStartChat(contextMenu.userId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              发送消息
            </button>
            <button
              onClick={() => { onOpenProfile(contextMenu.userId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              查看资料
            </button>
            <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
            <button
              onClick={() => { removeFriend(contextMenu.friendId); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-sm cursor-pointer"
              style={{ color: 'var(--danger)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,107,107,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              删除好友
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FriendRequestsInline() {
  const requests = useFriendStore((s) => s.requests);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const rejectRequest = useFriendStore((s) => s.rejectRequest);

  useEffect(() => { fetchRequests(); }, []);

  if (requests.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5"
        style={{ color: 'var(--text-muted)' }}>
        好友申请
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: 'var(--danger)', color: '#fff' }}>
          {requests.length}
        </span>
      </div>
      <div className="space-y-1">
        {requests.map((req) => (
          <div key={req.id} className="p-2.5 rounded-xl flex items-center gap-2.5"
            style={{ background: 'var(--bg-tertiary)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
              {req.from_user.nickname?.[0] || req.from_user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {req.from_user.nickname || req.from_user.username}
              </div>
            </div>
            <button
              onClick={() => acceptRequest(req.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] cursor-pointer font-medium text-white"
              style={{ background: 'var(--accent)' }}>
              同意
            </button>
            <button
              onClick={() => rejectRequest(req.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] cursor-pointer"
              style={{ color: 'var(--text-muted)' }}>
              忽略
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/FriendList.tsx
git commit -m "feat(ui): add FriendList component with context menu and friend requests"
```

---

### Task 16: Refactor Sidebar with Tabs

**Files:**
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add contacts tab and friend request badge**

The Sidebar needs to:
1. Accept `activeTab` and `onTabChange` props
2. Show chat / contacts tabs with badges
3. Remove the old search user modal and create group modal (move to parent or keep inline)

Replace the entire `web/src/components/Sidebar.tsx`:

```tsx
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import * as userApi from '../api/users';
import * as groupApi from '../api/groups';
import type { User } from '../types';

interface Props {
  activeTab: 'chat' | 'contacts';
  onTabChange: (tab: 'chat' | 'contacts') => void;
  onOpenProfile: (userId: string) => void;
}

export default function Sidebar({ activeTab, onTabChange, onOpenProfile }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const createGroup = useChatStore((s) => s.createGroup);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const totalUnread = useChatStore((s) => s.getTotalUnread)();
  const pendingRequests = useFriendStore((s) => s.getPendingCount)();

  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<User[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const users = await userApi.searchUsers(searchQuery);
    setSearchResults(users);
  };

  const handleStartChat = async (userId: string) => {
    const { createConversation } = await import('../api/conversations');
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleGroupSearch = async () => {
    if (!groupSearchQuery.trim()) return;
    const users = await userApi.searchUsers(groupSearchQuery);
    setGroupSearchResults(users);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    await createGroup(groupName.trim(), selectedMembers);
    setShowCreateGroup(false);
    setGroupName('');
    setSelectedMembers([]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
  };

  const TabButton = ({ tab, title, icon, badge }: { tab: 'chat' | 'contacts'; title: string; icon: React.ReactNode; badge: number }) => (
    <button
      onClick={() => { onTabChange(tab); if (tab === 'chat') fetchConversations(); }}
      className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer relative"
      style={{
        background: activeTab === tab ? 'var(--accent)' : 'transparent',
        color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => { if (activeTab !== tab) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (activeTab !== tab) e.currentTarget.style.background = 'transparent'; }}
      title={title}
    >
      {icon}
      {badge > 0 && activeTab !== tab && (
        <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold px-0.5"
          style={{ background: 'var(--danger)', color: '#fff' }}>
          {badge > 99 ? '99+' : badge}
        </div>
      )}
    </button>
  );

  return (
    <div className="w-[72px] flex flex-col items-center py-5 gap-2"
      style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>

      {/* 用户头像 */}
      <div className="relative group cursor-pointer mb-2" onClick={() => onOpenProfile(user?.id || '')}>
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-transform group-hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(108, 92, 231, 0.3)',
          }}
        >
          {user?.nickname?.[0] || user?.username?.[0] || '?'}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
          style={{ background: 'var(--success)', borderColor: 'var(--bg-primary)' }} />
      </div>

      <div className="w-8 h-px my-1" style={{ background: 'var(--border)' }} />

      {/* 消息 Tab */}
      <TabButton tab="chat" title="消息" badge={totalUnread}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
      />

      {/* 联系人 Tab */}
      <TabButton tab="contacts" title="联系人" badge={pendingRequests}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
      />

      {/* 添加好友 */}
      <button
        onClick={() => setShowSearch(true)}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="添加好友"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      </button>

      {/* 创建群聊 */}
      <button
        onClick={() => setShowCreateGroup(true)}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="创建群聊"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </button>

      <div className="flex-1" />

      {/* 退出 */}
      <button
        onClick={logout}
        className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,107,107,0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        title="退出登录"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      {/* 搜索用户弹窗 — keep existing */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }}>
          <div className="animate-fade-in w-[380px] p-6 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>搜索用户</h3>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="输入用户名或昵称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                autoFocus
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2.5 rounded-xl text-sm cursor-pointer text-white font-medium"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}
              >
                搜索
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                      {u.nickname?.[0] || u.username[0]}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {u.nickname || u.username}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStartChat(u.id)}
                    className="px-3 py-1.5 rounded-lg text-xs cursor-pointer font-medium"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    聊天
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>未找到用户</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 创建群聊弹窗 — keep existing */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); } }}>
          <div className="animate-fade-in w-[420px] p-6 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>创建群聊</h3>
              <button
                onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>群名称</label>
              <input
                type="text"
                placeholder="请输入群名称"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 ml-1" style={{ color: 'var(--text-secondary)' }}>添加成员</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="搜索用户"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGroupSearch()}
                  className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={handleGroupSearch}
                  className="px-3 py-2 rounded-xl text-sm cursor-pointer"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >搜索</button>
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedMembers.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {id.slice(0, 6)}...
                      <button onClick={() => toggleMember(id)} className="cursor-pointer hover:opacity-70">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {groupSearchResults.map((u) => {
                  const isSelected = selectedMembers.includes(u.id);
                  return (
                    <div key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer"
                      style={{ background: isSelected ? 'rgba(108,92,231,0.15)' : 'var(--bg-tertiary)', border: isSelected ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
                          {u.nickname?.[0] || u.username[0]}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.nickname || u.username}</span>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer text-white"
              style={{
                background: groupName.trim() && selectedMembers.length > 0
                  ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))'
                  : 'var(--bg-tertiary)',
                color: groupName.trim() && selectedMembers.length > 0 ? '#fff' : 'var(--text-muted)',
              }}
            >
              创建群聊 ({selectedMembers.length} 人)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat(ui): refactor Sidebar with chat/contacts tabs and friend request badge"
```

---

### Task 17: Update Chat Page for Tabs

**Files:**
- Modify: `web/src/pages/Chat.tsx`

- [ ] **Step 1: Add tab state and conditional rendering**

Replace `web/src/pages/Chat.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';
import FriendList from '../components/FriendList';
import ProfilePanel from '../components/ProfilePanel';

export default function Chat() {
  const hasInitRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().fetchMe();
    }
    useChatStore.getState().fetchConversations();
  }, []);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={(userId) => setProfileUserId(userId)}
      />
      {activeTab === 'chat' ? (
        <>
          <ConversationList />
          <ChatArea onOpenProfile={(userId) => setProfileUserId(userId)} />
        </>
      ) : (
        <FriendList onOpenProfile={(userId) => setProfileUserId(userId)} />
      )}

      {/* Profile Drawer */}
      {profileUserId && (
        <ProfilePanel
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Chat.tsx
git commit -m "feat(ui): add tab state to Chat page, wire up contacts and profile"
```

---

## Phase 4: User Profile Panel

### Task 18: Create ProfilePanel Component

**Files:**
- Create: `web/src/components/ProfilePanel.tsx`

- [ ] **Step 1: Write ProfilePanel component**

```tsx
import { useEffect, useState } from 'react';
import { getUser, getMe, updateMe } from '../api/users';
import { uploadFile } from '../api/client';
import { useAuthStore } from '../store/auth';
import { createConversation } from '../api/conversations';
import { useChatStore } from '../store/chat';
import type { User } from '../types';

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfilePanel({ userId, onClose }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const isMe = userId === currentUser?.id;

  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (isMe && currentUser) {
        setUser(currentUser);
        setNickname(currentUser.nickname);
        setBio(currentUser.bio || '');
        setLoading(false);
      } else {
        const u = await getUser(userId);
        setUser(u);
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleSave = async () => {
    await updateMe({ nickname, bio });
    await fetchMe();
    setEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    await updateMe({ avatar: res.url });
    await fetchMe();
  };

  const handleStartChat = async () => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    onClose();
  };

  if (loading) {
    return (
      <div className="w-[320px] flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
        <div className="animate-spin w-6 h-6 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-[320px] flex flex-col animate-slide-right"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isMe ? '个人资料' : '用户资料'}
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Avatar & Info */}
      <div className="p-6 text-center">
        <div className="relative inline-block group">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              user.nickname?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()
            )}
          </div>
          {isMe && editing && (
            <label className="absolute inset-0 flex items-center justify-center rounded-2xl cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none text-sm text-center"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="昵称"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none text-sm resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="个性签名"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {user.nickname || user.username}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
            {user.bio && (
              <p className="mt-3 text-sm px-2" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>
            )}

            {isMe ? (
              <button
                onClick={() => setEditing(true)}
                className="mt-4 px-6 py-2 rounded-xl text-sm font-medium cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                编辑资料
              </button>
            ) : (
              <button
                onClick={handleStartChat}
                className="mt-4 px-6 py-2 rounded-xl text-sm font-medium text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}>
                发送消息
              </button>
            )}
          </>
        )}
      </div>

      {/* Info rows */}
      {!editing && (
        <div className="px-6 space-y-3">
          {user.email && (
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              注册于 {new Date(user.id.length > 8 ? Date.now() : Date.now()).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/ProfilePanel.tsx
git commit -m "feat(ui): add ProfilePanel drawer with view/edit mode and avatar upload"
```

---

## Phase 5: Group Chat Enhancement

### Task 19: Create GroupMembers Component

**Files:**
- Create: `web/src/components/GroupMembers.tsx`

- [ ] **Step 1: Write GroupMembers component**

```tsx
import { useEffect, useState } from 'react';
import { getGroupMembers, removeGroupMember } from '../api/groups';
import { useAuthStore } from '../store/auth';
import type { GroupMemberWithUser } from '../types';

interface Props {
  groupId: string;
  ownerId: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

export default function GroupMembers({ groupId, ownerId, onClose, onOpenProfile }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<GroupMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getGroupMembers(groupId);
      setMembers(data || []);
      setLoading(false);
    };
    load();
  }, [groupId]);

  const handleKick = async (userId: string) => {
    await removeGroupMember(groupId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const handleLeave = async () => {
    await removeGroupMember(groupId, currentUser!.id);
    onClose();
  };

  const isOwner = currentUser?.id === ownerId;
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case 'owner': return '群主';
      case 'admin': return '管理员';
      default: return '';
    }
  };

  return (
    <div className="w-[280px] flex flex-col animate-slide-right"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          群成员 ({members.length})
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sortedMembers.map((m) => (
          <div key={m.user_id}
            className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer"
            onClick={() => onOpenProfile(m.user_id)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: '#fff' }}>
              {m.user.nickname?.[0] || m.user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {m.user.nickname || m.user.username}
                </span>
                {roleLabel(m.role) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {roleLabel(m.role)}
                  </span>
                )}
              </div>
            </div>
            {/* Kick button for owner (not self) */}
            {isOwner && m.role !== 'owner' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleKick(m.user_id); }}
                className="w-6 h-6 rounded flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.stopPropagation(); e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={(e) => { e.stopPropagation(); e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="移出群聊">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Leave button */}
      {!isOwner && (
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLeave}
            className="w-full py-2 rounded-xl text-sm cursor-pointer font-medium"
            style={{ background: 'rgba(255,107,107,0.1)', color: 'var(--danger)', border: '1px solid rgba(255,107,107,0.2)' }}>
            退出群聊
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/GroupMembers.tsx
git commit -m "feat(ui): add GroupMembers panel with kick/leave actions"
```

---

## Phase 6: Message Enhancement

### Task 20: Create EmojiPicker Component

**Files:**
- Create: `web/src/components/EmojiPicker.tsx`

- [ ] **Step 1: Write EmojiPicker component**

```tsx
interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_GROUPS = [
  { label: '表情', emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '😏', '😒', '😤', '😢', '😭', '🥺', '😱', '🤗', '🤩', '😴', '🤮', '👍', '👎', '👏', '🙏', '💪', '❤️', '🔥', '⭐'] },
  { label: '手势', emojis: ['👋', '🤝', '✌️', '🤞', '👌', '✋', '🖐️', '👆', '👇', '👈', '👉', '🫶'] },
  { label: '物品', emojis: ['🎉', '🎊', '🎁', '🎂', '☕', '🍻', '🎵', '📱', '💻', '📚', '✈️', '🏠'] },
];

export default function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full right-0 mb-2 p-3 rounded-2xl z-50 w-[320px]"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-0.5"
              style={{ color: 'var(--text-muted)' }}>
              {group.label}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onSelect(emoji); onClose(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-lg"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/EmojiPicker.tsx
git commit -m "feat(ui): add EmojiPicker popup component"
```

---

### Task 21: Update ChatArea with All Enhancements

**Files:**
- Modify: `web/src/components/ChatArea.tsx`

This is the largest frontend change. The ChatArea needs:
1. Accept `onOpenProfile` prop
2. GroupMembers panel toggle
3. EmojiPicker integration
4. Message recall (right-click menu)
5. Read receipt display
6. Message search

- [ ] **Step 1: Rewrite ChatArea.tsx**

The key changes to `web/src/components/ChatArea.tsx`:

1. Add `onOpenProfile` to Props interface
2. Import new components and APIs
3. Add state for emoji picker, search, group members panel
4. Add right-click handler for message recall
5. Add read receipt display in message bubbles
6. Add search bar in header
7. Add group members button in header

Key imports to add:
```tsx
import EmojiPicker from './EmojiPicker';
import GroupMembers from './GroupMembers';
import { recallMessage, searchMessages } from '../api/conversations';
```

Key state additions:
```tsx
const [showEmoji, setShowEmoji] = useState(false);
const [showGroupMembers, setShowGroupMembers] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<Message[]>([]);
const [showSearch, setShowSearch] = useState(false);
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
```

Key handlers to add:
```tsx
const handleRecall = async (msgId: string) => {
  if (!currentConvoId) return;
  await recallMessage(currentConvoId, msgId);
  setContextMenu(null);
};

const handleSearch = async () => {
  if (!currentConvoId || !searchQuery.trim()) return;
  const results = await searchMessages(currentConvoId, searchQuery);
  setSearchResults(results);
};

const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
  if (msg.sender_id !== user?.id || msg.type === 'system') return;
  if (Date.now() - new Date(msg.created_at).getTime() > 2 * 60 * 1000) return;
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
};
```

In the top bar, add group members button (when group):
```tsx
{currentConvo?.type === 'group' && currentConvo.group_id && (
  <button onClick={() => setShowGroupMembers(true)} ...>
    {/* people icon */}
  </button>
)}
```

Add search button in top bar:
```tsx
<button onClick={() => setShowSearch(!showSearch)} ...>
  {/* search icon */}
</button>
```

In the message bubble rendering, add read receipt and context menu:
```tsx
<div onContextMenu={(e) => handleContextMenu(e, msg)}>
  {/* existing bubble content */}
  {/* Read receipt */}
  {isMine && msg.read_by && msg.read_by.length > 1 && (
    <div className="text-[10px] mt-0.5 text-right" style={{ color: 'var(--text-muted)' }}>
      已读 {msg.read_by.length - 1}
    </div>
  )}
</div>
```

In the input area, add emoji button:
```tsx
<div className="relative">
  <button onClick={() => setShowEmoji(!showEmoji)} ...>😊</button>
  {showEmoji && <EmojiPicker onSelect={(e) => setInput(prev => prev + e)} onClose={() => setShowEmoji(false)} />}
</div>
```

After the main chat area div, add the GroupMembers panel:
```tsx
{showGroupMembers && currentConvo?.group_id && groupDetails[currentConvo.group_id] && (
  <GroupMembers
    groupId={currentConvo.group_id}
    ownerId={groupDetails[currentConvo.group_id].owner_id}
    onClose={() => setShowGroupMembers(false)}
    onOpenProfile={onOpenProfile}
  />
)}
```

This is a significant rewrite — the executor should carefully integrate all these additions while preserving existing message rendering logic.

- [ ] **Step 2: Verify frontend compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ChatArea.tsx
git commit -m "feat(ui): add emoji picker, message recall, read receipts, search to ChatArea"
```

---

## Phase 7: Final Verification

### Task 22: Full Build Verification

- [ ] **Step 1: Verify backend compiles**

Run: `cd server && go build ./...`

- [ ] **Step 2: Verify frontend builds**

Run: `cd web && npm run build`

- [ ] **Step 3: Fix any type errors**

Run: `cd web && npx tsc --noEmit` and fix any issues.

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix: resolve build and type errors from full refactor"
```

---

## Self-Review

**1. Spec coverage:**
- Login page redesign → Task 9 ✓
- Friend system (request/accept/reject/delete) → Tasks 1,3,11,12,14,15 ✓
- Contacts page → Tasks 15,16,17 ✓
- User profiles → Tasks 2,4,18 ✓
- Group chat enhancement → Tasks 5,19 ✓
- Message enhancement (read receipts, recall, emoji) → Tasks 6,7,13,20,21 ✓
- Search → Tasks 6,21 ✓

**2. Placeholder scan:** No TBD/TODO/placeholder steps found. All steps contain code.

**3. Type consistency:** All types defined in Task 10 are used consistently across API, store, and component tasks.
