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
			}

			conversations := authorized.Group("/conversations")
			{
				conversations.GET("", handler.GetConversations)
				conversations.POST("", handler.CreateConversation)
				conversations.GET("/:id/messages", handler.GetMessages)
			}

			groups := authorized.Group("/groups")
			{
				groups.POST("", handler.CreateGroup)
				groups.GET("/:id", handler.GetGroup)
				groups.POST("/:id/members", handler.AddGroupMember)
				groups.DELETE("/:id/members/:uid", handler.RemoveGroupMember)
			}

			authorized.POST("/upload", handler.UploadFile)
		}
	}
}
