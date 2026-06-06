import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import type { WSMessage, Message } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const unsubAuthRef = useRef<(() => void) | null>(null);

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

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${currentToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

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

    // Reconnect when token changes (e.g. after login)
    unsubAuthRef.current = useAuthStore.subscribe((state) => {
      if (state.token && !wsRef.current) {
        connect();
      } else if (!state.token && wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
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
    };
  }, []);

  return { send };
}
