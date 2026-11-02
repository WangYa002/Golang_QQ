import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';
import FriendList from '../components/FriendList';
import ProfilePanel from '../components/ProfilePanel';
import CallOverlay from '../components/CallOverlay';
import Admin from './Admin';
import { useWebSocket } from '../hooks/useWebSocket';
import TopBar from '../components/TopBar';
import FriendModals from '../components/FriendModals';
import { Mascot } from '../components/Mascot';

interface AiPush {
  title: string;
  content: string;
  ts: string;
}

export default function Chat() {
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'admin'>('chat');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const { send } = useWebSocket();

  // 小Q 主动推送（早报等）：顶部卡片展示 10s
  const [aiPush, setAiPush] = useState<AiPush | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onPush = (e: Event) => {
      setAiPush((e as CustomEvent<AiPush>).detail);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setAiPush(null), 10000);
    };
    window.addEventListener('qq-ai-push', onPush);
    return () => {
      window.removeEventListener('qq-ai-push', onPush);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 同步"聊天视图是否激活"：切到联系人/管理页时，来消息应计入未读；切回时当前会话视为已读
  useEffect(() => {
    useChatStore.getState().setChatViewActive(activeTab === 'chat');
  }, [activeTab]);

  // 守卫：非管理员强制回到聊天页
  const effectiveTab = activeTab === 'admin' && !isAdmin ? 'chat' : activeTab;

  // 首次挂载 + 账号切换时初始化：拉取当前账号资料与会话列表
  useEffect(() => {
    if (!userId) return;
    useAuthStore.getState().fetchMe();
    useChatStore.getState().fetchConversations();
    // 好友申请徽章初始化：登录/切号后立即拉取，避免侧边栏徽章一直为空
    useFriendStore.getState().fetchRequests();
  }, [userId]);

  return (
    <div className="app-shell">
      {/* 小Q 主动推送卡片 */}
      {aiPush && (
        <div className="ai-push-card" role="alert" onClick={() => setAiPush(null)}>
          <Mascot size={38} floating />
          <div className="ai-push-body">
            <div className="ai-push-title">{aiPush.title}</div>
            <div className="ai-push-content">{aiPush.content}</div>
          </div>
        </div>
      )}
      <TopBar onOpenProfile={(userId) => setProfileUserId(userId)} />
      <div className="chat-layout">
        <Sidebar
          activeTab={effectiveTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onOpenProfile={(userId) => setProfileUserId(userId)}
        />
        {effectiveTab === 'admin' ? (
          <Admin />
        ) : effectiveTab === 'chat' ? (
          <>
            <ConversationList />
            <ChatArea send={send} onOpenProfile={(userId) => setProfileUserId(userId)} />
          </>
        ) : (
          <FriendList onOpenProfile={(userId) => setProfileUserId(userId)} onEnterChat={() => setActiveTab('chat')} />
        )}

        {profileUserId && (
          <ProfilePanel
            key={profileUserId}
            userId={profileUserId}
            onClose={() => setProfileUserId(null)}
          />
        )}

        {/* 全局通话浮层：任何页面状态都能收到来电 */}
        <CallOverlay />
      </div>
      <FriendModals />
    </div>
  );
}
