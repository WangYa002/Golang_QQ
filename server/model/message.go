package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Message struct {
	ID             primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	ConversationID primitive.ObjectID   `bson:"conversation_id" json:"conversation_id"`
	SenderID       primitive.ObjectID   `bson:"sender_id" json:"sender_id"`
	Type           string               `bson:"type" json:"type"`
	Content        string               `bson:"content" json:"content"`
	Metadata       *MessageMetadata     `bson:"metadata,omitempty" json:"metadata,omitempty"`
	ReadBy         []primitive.ObjectID `bson:"read_by" json:"read_by"`
	CreatedAt      time.Time            `bson:"created_at" json:"created_at"`
}

type MessageMetadata struct {
	FileName string `bson:"file_name,omitempty" json:"file_name,omitempty"`
	FileSize int64  `bson:"file_size,omitempty" json:"file_size,omitempty"`
	Width    int    `bson:"width,omitempty" json:"width,omitempty"`
	Height   int    `bson:"height,omitempty" json:"height,omitempty"`
}
