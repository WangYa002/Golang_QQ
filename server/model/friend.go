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
	Status     string             `bson:"status" json:"status"`
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
