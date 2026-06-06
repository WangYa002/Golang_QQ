package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Conversation struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Type        string               `bson:"type" json:"type"`
	Members     []primitive.ObjectID `bson:"members" json:"members"`
	GroupID     *primitive.ObjectID  `bson:"group_id,omitempty" json:"group_id,omitempty"`
	LastMessage *LastMessage         `bson:"last_message,omitempty" json:"last_message,omitempty"`
	CreatedAt   time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time            `bson:"updated_at" json:"updated_at"`
}

type LastMessage struct {
	Content   string             `bson:"content" json:"content"`
	SenderID  primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	Type      string             `bson:"type" json:"type"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}
