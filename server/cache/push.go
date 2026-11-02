package cache

import (
	"context"
	"encoding/json"

	"github.com/redis/go-redis/v9"
)

// WS 跨实例广播 channel：多副本部署时，消息通过 Redis Pub/Sub 广播到所有实例，
// 每个实例只投递"本实例连接的"目标用户，实现跨节点消息可达。
const pushChannel = "im:ws:push"

// PushMsg 跨实例推送载荷。
type PushMsg struct {
	TargetIDs []string        `json:"target_ids"` // 目标用户 ID（hex）
	Gateway   string          `json:"gateway"`    // 发送实例标识（用于跳过本实例，防重复投递）
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
}

// PublishPush 将消息广播到所有网关实例。
func PublishPush(ctx context.Context, msg *PushMsg) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return RDB.Publish(ctx, pushChannel, data).Err()
}

// SubscribePush 订阅跨实例广播 channel。
func SubscribePush(ctx context.Context) *redis.PubSub {
	return RDB.Subscribe(ctx, pushChannel)
}

// PushChannelName 返回跨实例广播 channel 名（供日志展示）。
func PushChannelName() string {
	return pushChannel
}
