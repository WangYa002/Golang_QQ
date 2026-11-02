package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"

	"golang-qq/cache"
	"golang-qq/config"
	"golang-qq/model"
	"golang-qq/router"
	"golang-qq/scheduler"
	"golang-qq/ws"
)

func main() {
	config.Load()
	model.ConnectDB()
	cache.Init()
	defer cache.Close()

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
	hub.StartPushSubscriber() // 跨实例消息广播订阅（Redis Pub/Sub）
	scheduler.Start()    // 小Q 定时任务（每日早报推送）

	r := gin.Default()
	router.Setup(r)

	log.Println("Server starting on :" + config.AppConfig.Port)
	if err := r.Run(":" + config.AppConfig.Port); err != nil {
		log.Fatal("Server error:", err)
	}
}
