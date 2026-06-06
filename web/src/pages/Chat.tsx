import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';

export default function Chat() {
  const user = useAuthStore((s) => s.user);
  const fetchMeRef = useRef(useAuthStore.getState().fetchMe);
  const fetchConversationsRef = useRef(useChatStore.getState().fetchConversations);

  useEffect(() => {
    if (!useAuthStore.getState().user) {
      fetchMeRef.current();
    }
    fetchConversationsRef.current();
  }, []); // stable — no reactive deps that change

  return (
    <div className="h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <ConversationList />
      <ChatArea />
    </div>
  );
}
