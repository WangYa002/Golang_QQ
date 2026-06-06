package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"golang-qq/config"
	"golang-qq/model"
	"golang-qq/router"
	"golang-qq/ws"
)

func main() {
	config.Load()
	model.ConnectDB()

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
