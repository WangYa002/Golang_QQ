package cache

import (
	"context"
	"time"
)

// 在线状态 TTL：略大于协议层 ping 周期（约 54s），连接异常断开未显式 DEL 时，
// TTL 过期自动判定离线。
const onlineTTL = 70 * time.Second

// SetOnline 标记用户在线（直接 SET 覆盖 + TTL）。单点登录顶号逻辑由 Hub 层负责。
func SetOnline(ctx context.Context, userID, gatewayID string) error {
	return RDB.Set(ctx, keyOnline+userID, gatewayID, onlineTTL).Err()
}

// KeepOnline 心跳续期（连接存活期间周期性调用；由 WS PongHandler 触发）。
func KeepOnline(ctx context.Context, userID string) error {
	return RDB.Expire(ctx, keyOnline+userID, onlineTTL).Err()
}

// SetOffline 标记用户离线。
func SetOffline(ctx context.Context, userID string) error {
	return RDB.Del(ctx, keyOnline+userID).Err()
}

// IsOnline 判断用户是否在线。
func IsOnline(ctx context.Context, userID string) bool {
	n, err := RDB.Exists(ctx, keyOnline+userID).Result()
	return err == nil && n > 0
}

// GetGatewayID 获取用户当前连接的 gatewayID（可能为空）。
func GetGatewayID(ctx context.Context, userID string) string {
	return RDB.Get(ctx, keyOnline+userID).Val()
}
