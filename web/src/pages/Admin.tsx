import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../api/admin';
import { SearchIcon } from '../components/icons';
import type {
  AdminStats, AdminList, User, Conversation,
  AdminMessageRow, AdminGroupRow, AdminFriendRow, AdminRequestRow,
} from '../types';

type TabKey = 'users' | 'conversations' | 'messages' | 'groups' | 'friends' | 'friend_requests';

const PAGE_SIZE = 20;

function fmtTime(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function shortId(id?: string) {
  return id ? `${id.slice(0, 6)}…${id.slice(-4)}` : '—';
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color + '1f', color }}>
      {children}
    </span>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<TabKey>('users');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminList<unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setStats(await adminApi.getStats());
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const q = query.trim();
    const load = (async () => {
      switch (tab) {
        case 'users': return adminApi.listUsers(page, PAGE_SIZE, q);
        case 'conversations': return adminApi.listConversations(page, PAGE_SIZE);
        case 'messages': return adminApi.listMessages(page, PAGE_SIZE, q);
        case 'groups': return adminApi.listGroups(page, PAGE_SIZE);
        case 'friends': return adminApi.listFriends(page, PAGE_SIZE);
        case 'friend_requests': return adminApi.listFriendRequests(page, PAGE_SIZE);
      }
    })();
    load.then((res) => {
      setData(res as AdminList<unknown>);
      setLoading(false);
    }).catch(() => {
      setError('加载失败，请确认你有管理员权限');
      setLoading(false);
    });
  }, [tab, page, query]);

  const switchTab = (t: TabKey) => {
    setTab(t);
    setPage(1);
    setQuery('');
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const items = data?.items ?? [];

  const statCards = stats ? [
    { label: '用户总数', value: stats.users, color: '#3b82f6' },
    { label: '在线用户', value: stats.online_users, color: '#10b981' },
    { label: '会话数', value: stats.conversations, color: '#6366f1' },
    { label: '消息数', value: stats.messages, color: '#06b6d4' },
    { label: '群聊数', value: stats.groups, color: '#8b5cf6' },
    { label: '好友关系', value: stats.friends, color: '#f59e0b' },
    { label: '好友申请', value: stats.friend_requests, color: '#ec4899' },
    { label: '待处理申请', value: stats.pending_requests, color: '#ef4444' },
  ] : [];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'users', label: '用户' },
    { key: 'conversations', label: '会话' },
    { key: 'messages', label: '消息' },
    { key: 'groups', label: '群聊' },
    { key: 'friends', label: '好友' },
    { key: 'friend_requests', label: '好友申请' },
  ];

  const renderRow = (item: unknown): React.ReactNode => {
    switch (tab) {
      case 'users': {
        const u = item as User;
        return (
          <>
            <td>{u.username}</td>
            <td>{u.nickname || '—'}</td>
            <td>{u.email || '—'}</td>
            <td>
              <Badge color={u.status === 'online' ? '#10b981' : '#64748b'}>
                {u.status === 'online' ? '在线' : '离线'}
              </Badge>
            </td>
            <td>
              {u.role === 'admin' ? <Badge color="#f59e0b">管理员</Badge> : <Badge color="#64748b">用户</Badge>}
            </td>
            <td>{fmtTime((u as User & { created_at?: string }).created_at)}</td>
          </>
        );
      }
      case 'conversations': {
        const c = item as Conversation;
        return (
          <>
            <td>{shortId(c.id)}</td>
            <td>{c.type === 'group' ? '群聊' : '私聊'}</td>
            <td>{c.members?.length ?? 0}</td>
            <td>{c.group_id ? shortId(c.group_id) : '—'}</td>
            <td>{fmtTime(c.updated_at)}</td>
          </>
        );
      }
      case 'messages': {
        const m = item as AdminMessageRow;
        return (
          <>
            <td>{m.sender_name || shortId(m.sender_id)}</td>
            <td><Badge color="#06b6d4">{m.type}</Badge></td>
            <td className="max-w-[320px] truncate">{m.content}</td>
            <td>{shortId(m.conversation_id)}</td>
            <td>{fmtTime(m.created_at)}</td>
          </>
        );
      }
      case 'groups': {
        const g = item as AdminGroupRow;
        return (
          <>
            <td>{g.name}</td>
            <td>{g.owner_name || shortId(g.owner_id)}</td>
            <td>{g.member_count} / {g.max_members}</td>
            <td>{fmtTime(g.created_at)}</td>
          </>
        );
      }
      case 'friends': {
        const f = item as AdminFriendRow;
        return (
          <>
            <td>{f.user_name || shortId(f.user_id)}</td>
            <td>{f.friend_name || shortId(f.friend_id)}</td>
            <td>{f.remark || '—'}</td>
            <td>{fmtTime(f.created_at)}</td>
          </>
        );
      }
      case 'friend_requests': {
        const r = item as AdminRequestRow;
        return (
          <>
            <td>{r.from_name || shortId(r.from_user_id)}</td>
            <td>{r.to_name || shortId(r.to_user_id)}</td>
            <td>
              <Badge color={r.status === 'pending' ? '#f59e0b' : r.status === 'accepted' ? '#10b981' : '#64748b'}>
                {r.status === 'pending' ? '待处理' : r.status === 'accepted' ? '已接受' : '已拒绝'}
              </Badge>
            </td>
            <td className="max-w-[220px] truncate">{r.message || '—'}</td>
            <td>{fmtTime(r.created_at)}</td>
          </>
        );
      }
    }
  };

  const headers: Record<TabKey, string[]> = {
    users: ['用户名', '昵称', '邮箱', '状态', '角色', '注册时间'],
    conversations: ['ID', '类型', '成员数', '群 ID', '更新时间'],
    messages: ['发送者', '类型', '内容', '会话 ID', '时间'],
    groups: ['群名', '群主', '成员数', '创建时间'],
    friends: ['用户', '好友', '备注', '创建时间'],
    friend_requests: ['发起人', '接收人', '状态', '留言', '时间'],
  };

  return (
    <div className="chat-content flex-1 flex flex-col min-w-0"
      style={{ background: 'var(--bg-primary)' }}>

      {/* 头部 */}
      <div className="flex items-center justify-between px-8 h-16 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>管理后台</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>系统数据总览与明细</p>
        </div>
        <button
          onClick={() => { loadStats(); setQuery(query); }}
          className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer text-white"
          style={{ background: 'var(--accent)' }}
        >
          刷新数据
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {statCards.map((c) => (
            <div key={c.label} className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20"
                style={{ background: c.color }} />
              <div className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>
                {c.value.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Tab */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm cursor-pointer border-none"
              style={{
                background: tab === t.key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}

          {/* 搜索（用户/消息支持） */}
          {(tab === 'users' || tab === 'messages') && (
            <div className="relative ml-auto w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <SearchIcon size={15} />
              </div>
              <input
                type="text"
                placeholder={tab === 'users' ? '搜索用户名/昵称/邮箱' : '搜索消息内容'}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>

        {/* 表格 */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)' }}>
                  {headers[tab].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: i % 2 ? 'var(--bg-secondary)' : 'transparent',
                    }}>
                    {renderRow(item)}
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={headers[tab].length} className="px-4 py-10 text-center"
                      style={{ color: 'var(--text-muted)' }}>
                      {error || '暂无数据'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              共 {data?.total ?? 0} 条 · 第 {data?.page ?? 1} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
