import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import type { WSMessage, Message } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(useAuthStore.getState().token);
  const addMessageRef = useRef(useChatStore.getState().addMessage);
  const setTypingRef = useRef(useChatStore.getState().setTyping);
  const setUserOnlineRef = useRef(useChatStore.getState().setUserOnline);
  const setUserOfflineRef = useRef(useChatStore.getState().setUserOffline);

  // Keep refs in sync with store
  useAuthStore.subscribe((s) => { tokenRef.current = s.token; });
  useChatStore.subscribe((s) => {
    addMessageRef.current = s.addMessage;
    setTypingRef.current = s.setTyping;
    setUserOnlineRef.current = s.setUserOnline;
    setUserOfflineRef.current = s.setUserOffline;
  });

  const connect = useCallback(() => {
    const token = tokenRef.current;
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'new_message':
            addMessageRef.current(msg.data as Message);
            break;
          case 'typing': {
            const d = msg.data as { conversation_id: string; user_id: string };
            setTypingRef.current(d.conversation_id, d.user_id);
            break;
          }
          case 'user_online': {
            const d = msg.data as { user_id: string };
            setUserOnlineRef.current(d.user_id);
            break;
          }
          case 'user_offline': {
            const d = msg.data as { user_id: string };
            setUserOfflineRef.current(d.user_id);
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

    ws.onerror = () => {
      // onclose will fire after onerror, reconnection handled there
    };
  }, []); // stable — uses refs

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
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
  }, [connect]);

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  return { send };
}
