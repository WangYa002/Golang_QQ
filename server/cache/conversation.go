package cache

import (
	"context"
	"time"
)

// 会话列表缓存 TTL：5 分钟（配合消息发送/建会话时的主动失效，兼顾一致性与命中率）。
const convoListTTL = 5 * time.Minute

// GetConvoList 读取会话列表缓存（返回完整 JSON bytes；未命中返回 redis.Nil）。
func GetConvoList(ctx context.Context, userID string) ([]byte, error) {
	return RDB.Get(ctx, keyConvo+userID).Bytes()
}

// SetConvoList 写入会话列表缓存。
func SetConvoList(ctx context.Context, userID string, data []byte) error {
	return RDB.Set(ctx, keyConvo+userID, data, convoListTTL).Err()
}

// InvalidateConvoList 失效会话列表缓存（消息发送、建会话、删好友等操作后调用）。
func InvalidateConvoList(ctx context.Context, userID string) {
	RDB.Del(ctx, keyConvo+userID)
}
