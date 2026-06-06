import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import type { WSMessage, Message } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const token = useAuthStore((s) => s.token);
  const addMessage = useChatStore((s) => s.addMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const setUserOnline = useChatStore((s) => s.setUserOnline);
  const setUserOffline = useChatStore((s) => s.setUserOffline);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
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
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };
  }, [token, addMessage, setTyping, setUserOnline, setUserOffline]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  return { send };
}
