package cache

import (
	"context"
	"time"
)

// 消息幂等去重 TTL：24 小时，覆盖重试窗口。
const msgDedupTTL = 24 * time.Hour

// TryMarkMessage 幂等去重：首次处理返回 true 并打标；重复返回 false。
func TryMarkMessage(ctx context.Context, msgID string) (bool, error) {
	return RDB.SetNX(ctx, keyMsgDedup+msgID, "1", msgDedupTTL).Result()
}
