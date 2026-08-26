package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"

	"golang-qq/config"
	"golang-qq/model"
	"golang-qq/router"
	"golang-qq/ws"
)

func main() {
	config.Load()
	model.ConnectDB()

	// 管理员引导：env 指定用户名提升为管理员
	if config.AppConfig.AdminUsername != "" {
		res, err := model.Users.UpdateMany(context.Background(),
			bson.M{"username": config.AppConfig.AdminUsername},
			bson.M{"$set": bson.M{"role": "admin"}},
		)
		if err == nil && res.ModifiedCount > 0 {
			log.Printf("promoted %s to admin", config.AppConfig.AdminUsername)
		}
	}

	hub := ws.NewHub()
	ws.GlobalHub = hub
	go hub.Run()

	r := gin.Default()
	router.Setup(r)

	log.Println("Server starting on :" + config.AppConfig.Port)
	if err := r.Run(":" + config.AppConfig.Port); err != nil {
		log.Fatal("Server error:", err)
	}
}
