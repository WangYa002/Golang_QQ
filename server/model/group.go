package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Group struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name       string             `bson:"name" json:"name"`
	Avatar     string             `bson:"avatar" json:"avatar"`
	OwnerID    primitive.ObjectID `bson:"owner_id" json:"owner_id"`
	Members    []GroupMember      `bson:"members" json:"members"`
	MaxMembers   int                `bson:"max_members" json:"max_members"`
	Announcement string             `bson:"announcement" json:"announcement"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

type GroupMember struct {
	UserID   primitive.ObjectID `bson:"user_id" json:"user_id"`
	Role     string             `bson:"role" json:"role"`
	JoinedAt time.Time          `bson:"joined_at" json:"joined_at"`
}
