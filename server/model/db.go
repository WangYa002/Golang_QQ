package model

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"golang-qq/config"
)

var (
	DB            *mongo.Database
	Users         *mongo.Collection
	Conversations *mongo.Collection
	Messages      *mongo.Collection
	Groups        *mongo.Collection
)

func ConnectDB() {
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(config.AppConfig.MongoURI))
	if err != nil {
		log.Fatal("MongoDB connect error:", err)
	}

	err = client.Ping(context.Background(), nil)
	if err != nil {
		log.Fatal("MongoDB ping error: ", err, "\nPlease make sure MongoDB is running on ", config.AppConfig.MongoURI)
	}

	DB = client.Database(config.AppConfig.MongoDBName)
	Users = DB.Collection("users")
	Conversations = DB.Collection("conversations")
	Messages = DB.Collection("messages")
	Groups = DB.Collection("groups")

	createIndexes()

	log.Println("MongoDB connected:", config.AppConfig.MongoDBName)
}

func createIndexes() {
	Users.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: map[string]int{"username": 1}, Options: options.Index().SetUnique(true)},
	})
	Conversations.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: map[string]int{"members": 1}},
		{Keys: map[string]int{"updated_at": -1}},
		{Keys: map[string]int{"group_id": 1}},
	})
	Messages.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: map[string]int{"conversation_id": 1, "created_at": -1}},
	})
	Groups.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: map[string]int{"owner_id": 1}},
	})
}
