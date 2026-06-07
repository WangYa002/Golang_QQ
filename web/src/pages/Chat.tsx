import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';
import FriendList from '../components/FriendList';
import ProfilePanel from '../components/ProfilePanel';

export default function Chat() {
  const hasInitRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

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
