package cache

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"

	"golang-qq/config"
)

// Redis 客户端全局单例。
var RDB *redis.Client

// 键前缀统一管理。
const (
	keyOnline      = "im:online:"      // 在线状态（string，TTL 心跳续期）
	keyVerify      = "im:verify:"      // 邮箱验证码（string，5min）
	keyVerifyLimit = "im:verify:limit" // 验证码发送限流（string，1min）
	keyMsgDedup    = "im:msg:dedup:"   // 消息幂等去重（string，24h）
	keyOffline     = "im:offline:"     // 离线消息缓冲（list，7d）
	keyConvo       = "im:convo:"       // 会话列表缓存（zset）
	keyUnread      = "im:unread:"      // 未读计数（string）
)

// Init 连接 Redis 并 Ping 校验。
func Init() {
	RDB = redis.NewClient(&redis.Options{
		Addr:     config.AppConfig.RedisAddr,
		Password: config.AppConfig.RedisPassword,
		DB:       config.AppConfig.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := RDB.Ping(ctx).Err(); err != nil {
		log.Fatal("Redis connect error:", err, "\nPlease make sure Redis is running on ", config.AppConfig.RedisAddr)
	}
	log.Println("Redis connected:", config.AppConfig.RedisAddr)
}

// Close 关闭连接（优雅退出时调用）。
func Close() {
	if RDB != nil {
		_ = RDB.Close()
	}
}
