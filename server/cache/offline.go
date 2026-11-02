package cache

import (
	"context"
	"time"
)

// 离线消息 TTL：7 天。
const offlineTTL = 7 * 24 * time.Hour

// PushOffline 将离线消息推入用户离线队列（list，右侧追加）。
func PushOffline(ctx context.Context, userID, msgJSON string) error {
	key := keyOffline + userID
	if err := RDB.RPush(ctx, key, msgJSON).Err(); err != nil {
		return err
	}
	// 设置 TTL：队列至少保留 7 天
	return RDB.Expire(ctx, key, offlineTTL).Err()
}

// PopAllOffline 拉取并清空用户离线队列（按序返回）。
func PopAllOffline(ctx context.Context, userID string) ([]string, error) {
	key := keyOffline + userID
	// 一次性取出全部再删除
	msgs, err := RDB.LRange(ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}
	if len(msgs) > 0 {
		RDB.Del(ctx, key)
	}
	return msgs, nil
}
