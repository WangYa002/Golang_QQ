import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';

export default function Chat() {
  const hasInitRef = useRef(false);

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().fetchMe();
    }
    useChatStore.getState().fetchConversations();
  }, []);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <ConversationList />
      <ChatArea />
    </div>
  );
}
