import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useAccountsStore } from '../store/accounts';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import { useCallStore } from '../store/call';
import { sendMessageREST } from '../api/conversations';
import { uuid } from '../api/uuid';
import type { WSMessage, Message } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const unsubAuthRef = useRef<(() => void) | null>(null);
  const currentTokenRef = useRef<string | null>(null);
  // 发件箱：连接未就绪时暂存消息，连上后自动补发（避免静默丢消息）
  const outboxRef = useRef<string[]>([]);
  const sendRef = useRef<(type: string, data: unknown) => void>(() => {});

  useEffect(() => {
    mountedRef.current = true;

    const addMessage = useChatStore.getState().addMessage;
    const setTyping = useChatStore.getState().setTyping;
    const setUserOnline = useChatStore.getState().setUserOnline;
    const setUserOffline = useChatStore.getState().setUserOffline;

    const connect = () => {
      if (!mountedRef.current) return;

      const currentToken = useAuthStore.getState().token;
      if (!currentToken) return;

      // 若当前已连接（或正在连接）同一 token，无需重连；已关闭的连接则走下方重连
      if (wsRef.current && currentTokenRef.current === currentToken) {
        const st = wsRef.current.readyState;
        if (st === WebSocket.OPEN || st === WebSocket.CONNECTING) return;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      // 关闭旧连接（账号切换场景：旧 WS 必须断开，避免串号）
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      // 客户端模式注入 VITE_WS_URL（如 ws://localhost:8080/ws）；网页模式按当前域名推导
      const envWs = import.meta.env.VITE_WS_URL as string | undefined;
      let wsUrl: string;
      if (envWs) {
        wsUrl = `${envWs}?token=${currentToken}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws?token=${currentToken}`;
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      currentTokenRef.current = currentToken;

      // 连上后补发离线期间积压的消息
      ws.onopen = () => {
        if (outboxRef.current.length && wsRef.current === ws) {
          const queue = outboxRef.current;
          outboxRef.current = [];
          for (const payload of queue) ws.send(payload);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'new_message':
              addMessage(msg.data as Message);
              // 预取发送者昵称+头像，保证消息区头像即时显示
              {
                const d = msg.data as Message;
                if (d.sender_id) useChatStore.getState().fetchUserName(d.sender_id);
              }
              break;
            case 'typing': {
              const d = msg.data as { conversation_id: string; user_id: string };
              setTyping(d.conversation_id, d.user_id);
              break;
            }
            case 'user_online': {
              const d = msg.data as { user_id: string };
              setUserOnline(d.user_id);
              break;
            }
            case 'user_offline': {
              const d = msg.data as { user_id: string };
              setUserOffline(d.user_id);
              break;
            }
            case 'friend_request': {
              useFriendStore.getState().fetchRequests();
              break;
            }
            case 'friend_accepted': {
              useFriendStore.getState().fetchFriends();
              break;
            }
            case 'message_recalled': {
              const d = msg.data as { conversation_id: string; message_id: string };
              useChatStore.getState().handleMessageRecalled(d.conversation_id, d.message_id);
              break;
            }
            case 'ai_push': {
              // 小Q 主动推送（早报等）：转发给 UI 层展示
              const d = msg.data as { title: string; content: string; ts: string };
              window.dispatchEvent(new CustomEvent('qq-ai-push', { detail: d }));
              break;
            }
            case 'call_incoming':
            case 'call_accepted':
            case 'call_rejected':
            case 'call_ended':
            case 'call_signal': {
              useCallStore.getState().handleWSEvent(msg);
              break;
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (!mountedRef.current) return;
        // 账号在别处登录被顶下线（后端 ClosePolicyViolation=1008）：停止自动重连，
        // 避免与新连接互踢形成死循环。仅清除本窗口激活态（不动共享账号列表，
        // 其他窗口可继续使用该账号），auth store 同步回未登录态。
        if (event.code === 1008) {
          currentTokenRef.current = null;
          outboxRef.current = [];
          useAccountsStore.getState().clearSessionActive();
          window.alert('该账号已在其他设备登录，本窗口已下线');
          return;
        }
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {};
    };

    // 对外发送：连接就绪直接走 WS；未就绪时聊天消息走 HTTP 兜底（服务器落库并广播，
    // 本地立即上屏），其余类型入发件箱待连上补发，绝不静默丢消息
    sendRef.current = (type: string, data: unknown) => {
      const payload = JSON.stringify({ type, data });
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(payload);
        return;
      }
      const isChat = type === 'chat' && !!data && typeof data === 'object' && 'conversation_id' in data;
      if (isChat) {
        const d = data as Message & { client_msg_id?: string };
        const myId = useAuthStore.getState().user?.id ?? '';
        const localMsg: Message = {
          id: 'local-' + (d.client_msg_id ?? String(Date.now())),
          conversation_id: d.conversation_id,
          sender_id: myId,
          type: d.type ?? 'text',
          content: d.content,
          metadata: d.metadata,
          read_by: [myId],
          created_at: new Date().toISOString(),
        };
        sendMessageREST(d.conversation_id, {
          type: d.type ?? 'text',
          content: d.content,
          client_msg_id: d.client_msg_id ?? uuid(),
          metadata: d.metadata,
        })
          .then(() => useChatStore.getState().addMessage(localMsg))
          .catch(() => {
            // REST 也失败 → 退回发件箱，等 WS 恢复补发
            if (outboxRef.current.length < 100) outboxRef.current.push(payload);
          });
      } else if (outboxRef.current.length < 100) {
        outboxRef.current.push(payload);
      }
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        connect();
      }
    };

    // Connect when token exists
    const token = useAuthStore.getState().token;
    if (token) connect();

    // 订阅账号/token 变化：登录新账号、切换账号、登出
    unsubAuthRef.current = useAuthStore.subscribe((state) => {
      if (state.token) {
        // token 变化（登录/切换）→ 重连到新账号
        if (currentTokenRef.current !== state.token) {
          connect();
        }
      } else if (!state.token && wsRef.current) {
        // 全部账号登出 → 断开
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
        currentTokenRef.current = null;
      }
    });

    return () => {
      mountedRef.current = false;
      unsubAuthRef.current?.();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      outboxRef.current = [];
      currentTokenRef.current = null;
    };
  }, []);

  return { send: useCallback((type: string, data: unknown) => sendRef.current(type, data), []) };
}
