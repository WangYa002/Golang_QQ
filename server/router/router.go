package router

import (
	"github.com/gin-gonic/gin"

	"golang-qq/config"
	"golang-qq/handler"
	"golang-qq/middleware"
)

func Setup(r *gin.Engine) {
	r.Use(middleware.CORS())

	// 上传文件的静态服务与上传目录共用同一配置，避免保存/读取路径不一致
	r.Static("/uploads", config.AppConfig.UploadDir)

	// 转存到 HDFS 的大文件（流式读取，任意实例可服务）
	r.GET("/hdfs-files/:name", handler.ServeHDFSFile)

	r.GET("/ws", handler.HandleWebSocket)

	// MCP server 端点（RAG 透传）：外部 Agent 可经标准 JSON-RPC 复用小Q 工具
	r.POST("/api/mcp", handler.AiMcpEndpoint)

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", handler.Register)
			auth.POST("/login", handler.Login)
			auth.POST("/send-code", handler.SendVerifyCode)
			auth.POST("/login/email", handler.EmailLogin)
		}

		authorized := api.Group("")
		authorized.Use(middleware.AuthMiddleware())
		{
			users := authorized.Group("/users")
			{
				users.GET("/me", handler.GetMe)
				users.PUT("/me", handler.UpdateMe)
				users.GET("/search", handler.SearchUsers)
				users.GET("/:id", handler.GetUser)
			}

			conversations := authorized.Group("/conversations")
			{
				conversations.GET("", handler.GetConversations)
				conversations.POST("", handler.CreateConversation)
				conversations.GET("/:id/messages", handler.GetMessages)
				conversations.POST("/:id/messages", handler.SendMessage)
				conversations.DELETE("/:id/messages/:mid", handler.RecallMessage)
				conversations.GET("/:id/messages/search", handler.SearchMessages)
			}

			groups := authorized.Group("/groups")
			{
				groups.POST("", handler.CreateGroup)
				groups.GET("/:id", handler.GetGroup)
				groups.PUT("/:id", handler.UpdateGroup)
				groups.GET("/:id/members", handler.GetGroupMembers)
				groups.POST("/:id/members", handler.AddGroupMember)
				groups.DELETE("/:id/members/:uid", handler.RemoveGroupMember)
			}

			friends := authorized.Group("/friends")
			{
				friends.POST("/request", handler.SendFriendRequest)
				friends.GET("/requests", handler.GetFriendRequests)
				friends.PUT("/requests/:id", handler.HandleFriendRequest)
				friends.GET("", handler.GetFriends)
				friends.DELETE("/:id", handler.DeleteFriend)
				friends.PUT("/:id/remark", handler.UpdateFriendRemark)
			}

			authorized.POST("/upload", handler.UploadFile)

			// AI 助手（RAG-Assistant 代理）
			ai := authorized.Group("/ai")
			{
				ai.GET("/health", handler.AiHealth)
				ai.POST("/chat/stream", handler.AiChatStream)
				ai.GET("/documents", handler.AiDocList)
				ai.POST("/documents/upload", handler.AiDocUpload)
				ai.DELETE("/documents/:id", handler.AiDocDelete)
				ai.POST("/index/rebuild", handler.AiIndexRebuild)
				ai.POST("/archive/backfill", handler.AiArchiveBackfill)
				ai.POST("/push/trigger", handler.AiPushTrigger)
				ai.POST("/rate/:id", handler.AiRate)
				ai.GET("/mcp/tools", handler.AiMcpTools)
				ai.POST("/mcp/reload", handler.AiMcpReload)
			}
		}

		admin := api.Group("/admin")
		admin.Use(middleware.AuthMiddleware(), middleware.RequireAdmin())
		{
			admin.GET("/stats", handler.AdminStats)
			admin.GET("/users", handler.AdminListUsers)
			admin.GET("/conversations", handler.AdminListConversations)
			admin.GET("/messages", handler.AdminListMessages)
			admin.GET("/groups", handler.AdminListGroups)
			admin.GET("/friends", handler.AdminListFriends)
			admin.GET("/friend_requests", handler.AdminListFriendRequests)
		}
	}
}
