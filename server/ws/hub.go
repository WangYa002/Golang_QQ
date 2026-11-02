package ws

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"golang-qq/cache"
	"golang-qq/model"
)

type Hub struct {
	// 同一账号允许多端同时在线（多窗口/多设备）；连接集合为空才算离线
	Clients    map[primitive.ObjectID]map[*Client]struct{}
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *BroadcastMsg
	RedisPush  chan *BroadcastMsg // 跨实例推送入口（订阅 goroutine → 本 Hub 串行投递）
	GatewayID  string             // 本实例标识，写入 Redis 在线表 value
}

type BroadcastMsg struct {
	TargetIDs []primitive.ObjectID
	Type      string
	Data      interface{}
}

var GlobalHub *Hub

func NewHub() *Hub {
	host, _ := os.Hostname()
	return &Hub{
		Clients:    make(map[primitive.ObjectID]map[*Client]struct{}),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *BroadcastMsg, 256),
		RedisPush:  make(chan *BroadcastMsg, 256),
		GatewayID:  host + ":" + os.Getenv("PORT"),
	}
}

// safeSend 带背压的投递：客户端发送缓冲满（慢消费者）时直接断开连接，
// 避免阻塞 Hub 主循环拖垮所有消息转发。
func (h *Hub) safeSend(client *Client, msg *BroadcastMsg) {
	select {
	case client.Send <- msg:
	default:
		log.Printf("[hub] slow consumer, closing conn user=%s", client.UserID.Hex())
		client.Close()
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			// 多端在线：同一账号新连接并存，不再踢旧连接
			if h.Clients[client.UserID] == nil {
				h.Clients[client.UserID] = make(map[*Client]struct{})
			}
			h.Clients[client.UserID][client] = struct{}{}

			// Redis 在线状态：标记在线（TTL 由心跳续期）
			cache.SetOnline(context.Background(), client.UserID.Hex(), h.GatewayID)

			// 下发离线消息：上线即推，推完清空 Redis 离线队列（trySend 防阻塞/panic）
			go func(client *Client) {
				msgs, err := cache.PopAllOffline(context.Background(), client.UserID.Hex())
				if err != nil || len(msgs) == 0 {
					return
				}
				for _, raw := range msgs {
					var m map[string]interface{}
					if json.Unmarshal([]byte(raw), &m) != nil {
						continue
					}
					client.trySend(&BroadcastMsg{
						Type: "new_message",
						Data: m,
					})
				}
			}(client)

			// 向新连接推送当前在线用户快照（不含自己），
			// 使其登录后立即知道谁在线，不依赖后续广播。
			for id := range h.Clients {
				if id == client.UserID {
					continue
				}
				client.trySend(&BroadcastMsg{
					Type: "user_online",
					Data: map[string]string{"user_id": id.Hex()},
				})
			}

		case client := <-h.Unregister:
			// 从该用户的连接集合移除；集合空了才真正下线（离线广播 + 状态落库），
			// 避免多端场景下一端退出误报下线。
			// 通话收线：断线即终结该用户参与的通话（刷新页面/断网不留僵尸，
			// 对方立即收到 call_ended；见 calls.go 的取舍说明）。
			EndCallsForUser(h, client.UserID)
			if conns, ok := h.Clients[client.UserID]; ok {
				delete(conns, client)
				if len(conns) == 0 {
					delete(h.Clients, client.UserID)

					cache.SetOffline(context.Background(), client.UserID.Hex())

					model.Users.UpdateByID(context.Background(), client.UserID, bson.M{
						"$set": bson.M{"status": "offline", "updated_at": time.Now()},
					})

					h.Broadcast <- &BroadcastMsg{
						TargetIDs: []primitive.ObjectID{},
						Type:      "user_offline",
						Data:      map[string]string{"user_id": client.UserID.Hex()},
					}
				}
			}
			close(client.Send)

		case msg := <-h.Broadcast:
			// 本地投递 + 跨实例广播（Redis Pub/Sub）
			h.deliverLocal(msg)
			h.publishCrossNode(msg)

		case msg := <-h.RedisPush:
			// 其他实例推来的消息：只投递本实例连接的 Target
			h.deliverLocal(msg)
		}
	}
}

// deliverLocal 投递给本实例内的连接（带背压保护）；同一用户多端在线时全部投递。
func (h *Hub) deliverLocal(msg *BroadcastMsg) {
	if len(msg.TargetIDs) == 0 {
		for _, conns := range h.Clients {
			for client := range conns {
				h.safeSend(client, msg)
			}
		}
		return
	}
	for _, id := range msg.TargetIDs {
		for client := range h.Clients[id] {
			h.safeSend(client, msg)
		}
	}
}

// publishCrossNode 通过 Redis Pub/Sub 广播到其他实例（本实例已本地投递，
// 订阅方通过 Gateway 标识跳过发送实例，避免重复）。
func (h *Hub) publishCrossNode(msg *BroadcastMsg) {
	targets := make([]string, 0, len(msg.TargetIDs))
	for _, id := range msg.TargetIDs {
		targets = append(targets, id.Hex())
	}
	data, err := json.Marshal(msg.Data)
	if err != nil {
		return
	}
	cache.PublishPush(context.Background(), &cache.PushMsg{
		TargetIDs: targets,
		Gateway:   h.GatewayID,
		Type:      msg.Type,
		Data:      data,
	})
}

// StartPushSubscriber 订阅 Redis 跨实例广播，收到的消息进入 h.RedisPush，
// 由 Hub 主循环串行投递（保证顺序性 + 避免并发访问 Clients map）。
func (h *Hub) StartPushSubscriber() {
	ctx := context.Background()
	sub := cache.SubscribePush(ctx)
	go func() {
		defer sub.Close()
		for {
			msg, err := sub.ReceiveMessage(ctx)
			if err != nil {
				log.Printf("[push-sub] error: %v", err)
				time.Sleep(time.Second)
				continue
			}
			var pm cache.PushMsg
			if err := json.Unmarshal([]byte(msg.Payload), &pm); err != nil {
				continue
			}
			// 跳过本实例发布的消息（已在 Broadcast 分支本地投递）
			if pm.Gateway == h.GatewayID {
				continue
			}
			targetIDs := make([]primitive.ObjectID, 0, len(pm.TargetIDs))
			for _, s := range pm.TargetIDs {
				if id, err := primitive.ObjectIDFromHex(s); err == nil {
					targetIDs = append(targetIDs, id)
				}
			}
			h.RedisPush <- &BroadcastMsg{
				TargetIDs: targetIDs,
				Type:      pm.Type,
				Data:      pm.Data, // json.RawMessage，WritePump 直接透传
			}
		}
	}()
	log.Printf("[push-sub] subscribed to %s as %s", cache.PushChannelName(), h.GatewayID)
}

// IsOnline 判断用户是否在线：优先查 Redis（跨实例共享），
// Redis 不可用时回退到进程内连接表。
func (h *Hub) IsOnline(userID primitive.ObjectID) bool {
	if cache.IsOnline(context.Background(), userID.Hex()) {
		return true
	}
	_, ok := h.Clients[userID]
	return ok
}
