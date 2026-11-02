package ws

import (
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

/**
 * 服务端通话状态注册表（私聊场景）：
 * - busy 判定收归服务端（不依赖客户端僵尸状态）
 * - 通话结束（挂断/拒接/断线）广播给双方全部在线连接（多端同步收线）
 * - 连接断开即终结该用户参与的通话（页面刷新/断网不再留僵尸，对方必收到 call_ended）
 */

type ActiveCall struct {
	ID        string
	ConvoID   primitive.ObjectID
	CallerID  primitive.ObjectID
	CalleeID  primitive.ObjectID
	Accepted  bool
	CreatedAt time.Time
}

var (
	callsMu         sync.Mutex
	activeCalls     = map[string]*ActiveCall{}                // callID → call
	userActiveCall  = map[primitive.ObjectID]string{}          // userID → callID
)

// CallBusy 用户是否有未结束的通话（振铃或进行中）
func CallBusy(userID primitive.ObjectID) bool {
	callsMu.Lock()
	defer callsMu.Unlock()
	id, ok := userActiveCall[userID]
	if !ok {
		return false
	}
	_, alive := activeCalls[id]
	return alive
}

// RegisterCall 登记一路新通话（调用前应已确认双方不忙）。返回 callID。
func RegisterCall(convoID, callerID, calleeID primitive.ObjectID) string {
	callsMu.Lock()
	defer callsMu.Unlock()
	callID := primitive.NewObjectID().Hex()
	call := &ActiveCall{ID: callID, ConvoID: convoID, CallerID: callerID, CalleeID: calleeID, CreatedAt: time.Now()}
	activeCalls[callID] = call
	userActiveCall[callerID] = callID
	userActiveCall[calleeID] = callID
	return callID
}

// MarkAccepted 标记接通（后续 hangup 才视为正常结束而非取消）
func MarkAccepted(callID string) {
	callsMu.Lock()
	defer callsMu.Unlock()
	if c, ok := activeCalls[callID]; ok {
		c.Accepted = true
	}
}

// FinishCall 结束并移除一路通话，返回其信息（不存在返回 nil）
func FinishCall(callID string) *ActiveCall {
	callsMu.Lock()
	defer callsMu.Unlock()
	c, ok := activeCalls[callID]
	if !ok {
		return nil
	}
	delete(activeCalls, callID)
	if userActiveCall[c.CallerID] == callID {
		delete(userActiveCall, c.CallerID)
	}
	if userActiveCall[c.CalleeID] == callID {
		delete(userActiveCall, c.CalleeID)
	}
	return c
}

// EndCallsForUser 终结该用户参与的全部通话，并向通话另一方广播 call_ended。
// 用于 WS 连接断开（页面刷新/断网）：不留僵尸，对方立即收线。
// 注：多端在线时若断开的是未参与媒体的另一台设备也会收线——
// 同账号多端同时只有一台能真正进行媒体通话，该取舍可接受。
func EndCallsForUser(hub *Hub, userID primitive.ObjectID) {
	callsMu.Lock()
	callIDs := make([]string, 0, 1)
	if id, ok := userActiveCall[userID]; ok {
		if _, alive := activeCalls[id]; alive {
			callIDs = append(callIDs, id)
		}
	}
	callsMu.Unlock()

	for _, id := range callIDs {
		c := FinishCall(id)
		if c == nil {
			continue
		}
		peer := c.CalleeID
		if userID == c.CalleeID {
			peer = c.CallerID
		}
		hub.Broadcast <- &BroadcastMsg{
			TargetIDs: []primitive.ObjectID{peer},
			Type:      "call_ended",
			Data: map[string]interface{}{
				"call_id":         c.ID,
				"conversation_id": c.ConvoID.Hex(),
			},
		}
	}
}
