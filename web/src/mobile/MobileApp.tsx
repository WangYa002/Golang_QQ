import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import { useWebSocket } from '../hooks/useWebSocket';
import { avatarSrc, mediaUrl, uploadFile } from '../api/client';
import { createConversation } from '../api/conversations';
import { searchUsers } from '../api/users';
import { uuid } from '../api/uuid';
import { Mascot } from '../components/Mascot';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { Conversation, User } from '../types';
import './mobile.css';

type Tab = 'messages' | 'contacts' | 'me';

function displayTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function Avatar({ name, src, group = false }: { name: string; src?: string; group?: boolean }) {
  return <span className={`m-avatar${group ? ' group' : ''}`}>
    {src ? <img src={src} alt="" /> : <span>{group ? '群' : (name.trim()[0] || 'Q').toUpperCase()}</span>}
  </span>;
}

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1700);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return <div className="m-splash" aria-label="Golang QQ 正在启动">
    <div className="m-splash-orbit"><span className="m-splash-mascot"><Mascot size={92} /></span></div>
    <h1>Golang QQ</h1><p>每一天，乐在沟通</p>
    <span className="m-splash-loading" />
  </div>;
}

function MobileLogin() {
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password, nickname.trim());
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败，请稍后重试'); }
    finally { setBusy(false); }
  }
  return <main className="m-login">
    <div className="m-login-art"><span className="m-login-mascot"><Mascot size={84} floating /></span><h1>Golang QQ</h1><p>聊得来，随时都在</p></div>
    <form className="m-login-card" onSubmit={submit}>
      <h2>{mode === 'login' ? '欢迎回来' : '创建账号'}</h2>
      <p>连接你的朋友，开启新对话。</p>
      {mode === 'register' && <label>昵称<input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="怎么称呼你" required /></label>}
      <label>账号<input autoCapitalize="none" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="输入用户名" required /></label>
      <label>密码<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" required /></label>
      {error && <div className="m-error" role="alert">{error}</div>}
      <button className="m-primary" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}</button>
      <button className="m-text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
        {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
      </button>
    </form>
  </main>;
}

function MobileChat() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const { send } = useWebSocket();
  const { conversations, currentConvoId, messages, userNames, userAvatars, groupDetails, unreadCount, convPrefs, fetchConversations, selectConversation, clearSelection, fetchUserName, fetchGroupDetails, markAsRead } = useChatStore();
  const { friends, requests, fetchFriends, fetchRequests, acceptRequest, rejectRequest, sendRequest } = useFriendStore();
  const [tab, setTab] = useState<Tab>('messages');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [searchResult, setSearchResult] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    void useAuthStore.getState().fetchMe();
    void fetchConversations().catch(() => setNotice('无法加载会话，请检查网络'));
    void fetchFriends().catch(() => {});
    void fetchRequests().catch(() => {});
  }, [user?.id, fetchConversations, fetchFriends, fetchRequests]);

  useEffect(() => {
    conversations.forEach(c => {
      if (c.type === 'private') {
        const other = c.members?.find(id => id !== user?.id);
        if (other && !userNames[other]) void fetchUserName(other);
      } else if (c.group_id && !groupDetails[c.group_id]) void fetchGroupDetails(c.group_id);
    });
  }, [conversations, user?.id, userNames, groupDetails, fetchUserName, fetchGroupDetails]);

  useEffect(() => { useChatStore.getState().setChatViewActive(tab === 'messages' && !!currentConvoId); }, [tab, currentConvoId]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let disposed = false;
    let handle: PluginListenerHandle | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (currentConvoId && tab === 'messages') clearSelection();
      else if (tab !== 'messages') setTab('messages');
      else void CapacitorApp.minimizeApp();
    }).then(listener => {
      if (disposed) void listener.remove();
      else handle = listener;
    });
    return () => { disposed = true; if (handle) void handle.remove(); };
  }, [currentConvoId, tab, clearSelection]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentConvoId, messages]);

  const current = conversations.find(c => c.id === currentConvoId);
  const otherId = (c: Conversation) => c.members?.find(id => id !== user?.id) || '';
  const nameOf = (c: Conversation) => c.type === 'group' ? groupDetails[c.group_id || '']?.name || '群聊' : userNames[otherId(c)] || '好友';
  const avatarOf = (c: Conversation) => c.type === 'group' ? undefined : avatarSrc(userAvatars[otherId(c)]);

  async function openConversation(id: string) {
    try { await selectConversation(id); markAsRead(id); setTab('messages'); }
    catch { setNotice('消息加载失败，请重试'); }
  }
  function sendText(event: FormEvent) {
    event.preventDefault();
    if (!currentConvoId || !draft.trim()) return;
    send('chat', { conversation_id: currentConvoId, type: 'text', content: draft.trim(), client_msg_id: uuid() });
    setDraft('');
  }
  async function sendFile(file?: File) {
    if (!file || !currentConvoId) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      send('chat', { conversation_id: currentConvoId, type: file.type.startsWith('image/') ? 'image' : 'file', content: result.url, metadata: { file_name: file.name, file_size: file.size }, client_msg_id: uuid() });
    } catch { setNotice('文件发送失败，请重试'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function search() {
    if (!query.trim()) { setSearchResult([]); return; }
    setSearching(true);
    try { setSearchResult(await searchUsers(query.trim())); }
    catch { setNotice('搜索失败，请重试'); }
    finally { setSearching(false); }
  }
  async function startChat(id: string) {
    try {
      const c = await createConversation(id);
      await fetchConversations();
      await openConversation(c.id);
    } catch { setNotice('暂时无法发起会话'); }
  }
  async function addFriend(id: string) {
    try { await sendRequest(id, '你好，我们加个好友吧'); setNotice('好友申请已发送'); }
    catch (e) { setNotice(e instanceof Error ? e.message : '发送申请失败'); }
  }
  const visible = conversations.filter(c => !convPrefs[c.id]?.hidden && nameOf(c).toLowerCase().includes(query.toLowerCase()));
  const count = Object.values(unreadCount).reduce((a, b) => a + b, 0);

  return <div className="m-app">
    {current && tab === 'messages' ? <>
      <header className="m-chat-header">
        <button aria-label="返回消息" onClick={() => clearSelection()} className="m-back">‹</button>
        <Avatar name={nameOf(current)} src={avatarOf(current)} group={current.type === 'group'} />
        <div className="m-chat-heading"><strong>{nameOf(current)}</strong><small>{current.type === 'group' ? '群聊' : '在线畅聊'}</small></div>
      </header>
      <div className="m-thread" aria-live="polite">
        {(messages[current.id] || []).map(msg => {
          const mine = msg.sender_id === user?.id;
          if (msg.type === 'system' || msg.type === 'recalled') return <p className="m-system" key={msg.id}>{msg.content}</p>;
          const sender = mine ? user?.nickname || user?.username || '我' : userNames[msg.sender_id] || nameOf(current);
          return <div className={`m-message${mine ? ' mine' : ''}`} key={msg.id}>
            {!mine && <Avatar name={sender} src={avatarSrc(userAvatars[msg.sender_id])} />}
            <div><div className="m-bubble">
              {msg.type === 'image' ? <img className="m-message-image" src={mediaUrl(msg.content)} alt="聊天图片" onClick={() => window.open(mediaUrl(msg.content), '_blank')} />
                : msg.type === 'file' ? <a href={mediaUrl(msg.content)} target="_blank" rel="noreferrer">📎 {msg.metadata?.file_name || '下载文件'}</a>
                : msg.content}
            </div><small>{displayTime(msg.created_at)}</small></div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>
      <form className="m-composer" onSubmit={sendText}>
        <input ref={fileRef} type="file" hidden onChange={e => void sendFile(e.target.files?.[0])} />
        <button type="button" aria-label="发送图片或文件" disabled={uploading} onClick={() => fileRef.current?.click()} className="m-attach">＋</button>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="发消息…" aria-label="消息内容" />
        <button className="m-send" type="submit" disabled={!draft.trim()}>发送</button>
      </form>
    </> : <>
      <header className="m-header"><div><span className="m-eyebrow">GOLANG QQ</span><h1>{tab === 'messages' ? '消息' : tab === 'contacts' ? '联系人' : '我的'}</h1></div><span className="m-header-mark"><Mascot size={40} /></span></header>
      {tab === 'messages' && <>
        <div className="m-search"><input aria-label="搜索会话" placeholder="搜索聊天" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <main className="m-list">
          {visible.length === 0 && <div className="m-empty"><Mascot size={74} /><h2>{query ? '没有找到会话' : '还没有消息'}</h2><p>去联系人页面，和朋友打个招呼吧。</p></div>}
          {visible.map(c => <button key={c.id} className="m-row" onClick={() => void openConversation(c.id)}>
            <Avatar name={nameOf(c)} src={avatarOf(c)} group={c.type === 'group'} />
            <span className="m-row-content"><span className="m-row-top"><strong>{nameOf(c)}</strong><small>{displayTime(c.last_message?.created_at || c.updated_at)}</small></span><span className="m-row-bottom"><span>{c.last_message?.type === 'image' ? '[图片]' : c.last_message?.type === 'file' ? '[文件]' : c.last_message?.content || '开始聊天'}</span>{!!unreadCount[c.id] && <b>{unreadCount[c.id] > 99 ? '99+' : unreadCount[c.id]}</b>}</span></span>
          </button>)}
        </main>
      </>}
      {tab === 'contacts' && <main className="m-list m-contacts">
        <form className="m-search" onSubmit={e => { e.preventDefault(); void search(); }}><input aria-label="搜索用户" placeholder="搜索用户名或昵称" value={query} onChange={e => setQuery(e.target.value)} /><button>{searching ? '搜索中' : '搜索'}</button></form>
        {searchResult.length > 0 && <><h2 className="m-section">搜索结果</h2>{searchResult.filter(u => u.id !== user?.id).map(u => <div className="m-row" key={u.id}><Avatar name={u.nickname || u.username} src={avatarSrc(u.avatar)} /><span className="m-row-content"><strong>{u.nickname || u.username}</strong><small>@{u.username}</small></span><button className="m-outline" onClick={() => void addFriend(u.id)}>加好友</button></div>)}</>}
        {requests.length > 0 && <><h2 className="m-section">好友申请 · {requests.length}</h2>{requests.map(r => <div className="m-row" key={r.id}><Avatar name={r.from_user.nickname || r.from_user.username} src={avatarSrc(r.from_user.avatar)} /><span className="m-row-content"><strong>{r.from_user.nickname || r.from_user.username}</strong><small>{r.message}</small></span><button className="m-outline" onClick={() => void acceptRequest(r.id)}>同意</button><button className="m-quiet" onClick={() => void rejectRequest(r.id)}>忽略</button></div>)}</>}
        <h2 className="m-section">我的好友 · {friends.length}</h2>
        {friends.map(f => <button key={f.id} className="m-row" onClick={() => void startChat(f.user.id)}><Avatar name={f.remark || f.user.nickname || f.user.username} src={avatarSrc(f.user.avatar)} /><span className="m-row-content"><strong>{f.remark || f.user.nickname || f.user.username}</strong><small>点击开始聊天</small></span><span className="m-chevron">›</span></button>)}
        {friends.length === 0 && <p className="m-hint">搜索用户，添加你的第一位好友。</p>}
      </main>}
      {tab === 'me' && <main className="m-list m-me"><div className="m-profile"><Avatar name={user?.nickname || user?.username || '我'} src={avatarSrc(user?.avatar)} /><div><h2>{user?.nickname || user?.username}</h2><p>@{user?.username}</p></div></div><div className="m-me-card"><div><span>账号</span><strong>{user?.username}</strong></div><div><span>邮箱</span><strong>{user?.email || '未设置'}</strong></div><div><span>个人介绍</span><strong>{user?.bio || '让每一次交流都有温度'}</strong></div></div><button className="m-logout" onClick={logout}>退出登录</button></main>}
      <nav className="m-nav" aria-label="主导航"><button className={tab === 'messages' ? 'active' : ''} onClick={() => { setTab('messages'); setQuery(''); }}><span>◉</span>消息{count > 0 && <i />}</button><button className={tab === 'contacts' ? 'active' : ''} onClick={() => { setTab('contacts'); setQuery(''); }}><span>♧</span>联系人{requests.length > 0 && <i />}</button><button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}><span>◌</span>我的</button></nav>
    </>}
    {notice && <button className="m-toast" onClick={() => setNotice('')} role="alert">{notice}</button>}
  </div>;
}

export default function MobileApp({ authenticated }: { authenticated: boolean }) {
  const [splash, setSplash] = useState(true);
  return splash ? <Splash onDone={() => setSplash(false)} /> : authenticated ? <MobileChat /> : <MobileLogin />;
}
