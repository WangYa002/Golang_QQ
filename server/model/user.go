package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
