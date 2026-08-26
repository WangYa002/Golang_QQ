import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import type { WSMessage, Message } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const unsubAuthRef = useRef<(() => void) | null>(null);
  const currentTokenRef = useRef<string | null>(null);

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

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

      // 若当前已连接同一 token，无需重连
      if (wsRef.current && currentTokenRef.current === currentToken) return;

      // 关闭旧连接（账号切换场景：旧 WS 必须断开，避免串号）
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${currentToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      currentTokenRef.current = currentToken;

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'new_message':
              addMessage(msg.data as Message);
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
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!mountedRef.current) return;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {};
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
      currentTokenRef.current = null;
    };
  }, []);

  return { send };
}
