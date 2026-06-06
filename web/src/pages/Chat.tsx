import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';

export default function Chat() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const user = useAuthStore((s) => s.user);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    if (!user) fetchMe();
    fetchConversations();
  }, [user, fetchMe, fetchConversations]);

  return (
    <div className="h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <ConversationList />
      <ChatArea />
    </div>
  );
}
