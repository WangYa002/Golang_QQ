import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';
import FriendList from '../components/FriendList';
import ProfilePanel from '../components/ProfilePanel';

export default function Chat() {
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  // 首次挂载 + 账号切换时初始化：拉取当前账号资料与会话列表
  useEffect(() => {
    if (!userId) return;
    useAuthStore.getState().fetchMe();
    useChatStore.getState().fetchConversations();
  }, [userId]);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={(userId) => setProfileUserId(userId)}
      />
      {activeTab === 'chat' ? (
        <>
          <ConversationList />
          <ChatArea onOpenProfile={(userId) => setProfileUserId(userId)} />
        </>
      ) : (
        <FriendList onOpenProfile={(userId) => setProfileUserId(userId)} />
      )}

      {profileUserId && (
        <ProfilePanel
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
