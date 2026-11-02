import { useState } from 'react';
import * as userApi from '../api/users';
import { createConversation } from '../api/conversations';
import { useChatStore } from '../store/chat';
import { useFriendStore } from '../store/friend';
import { useUIStore } from '../store/ui';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { CloseIcon, CheckIcon } from './icons';
import type { User } from '../types';

/**
 * 全局好友/群聊弹窗：搜索用户（加好友）+ 创建群聊。
 * 由 UI store 的标志位控制，可在任意页面从「+」或菜单触发。
 */
export default function FriendModals() {
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);

  const showSearch = useUIStore((s) => s.addFriendOpen);
  const closeAddFriend = useUIStore((s) => s.closeAddFriend);
  const showCreateGroup = useUIStore((s) => s.createGroupOpen);
  const closeCreateGroup = useUIStore((s) => s.closeCreateGroup);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);
  const [friendError, setFriendError] = useState('');

  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<User[]>([]);

  const sendRequest = useFriendStore((s) => s.sendRequest);

  const handleCloseAddFriend = () => {
    closeAddFriend();
    setSearchQuery('');
    setSearchResults([]);
    setFriendError('');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const users = await userApi.searchUsers(searchQuery);
    setSearchResults(users);
  };

  const handleStartChat = async (userId: string) => {
    const convo = await createConversation(userId);
    await fetchConversations();
    selectConversation(convo.id);
    handleCloseAddFriend();
  };

  const handleSendFriendRequest = async (userId: string) => {
    setFriendError('');
    try {
      await sendRequest(userId, '');
      setSentRequestIds((prev) => [...prev, userId]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      const map: Record<string, string> = {
        'already friends': '你们已经是好友了',
        'request already exists': '好友申请已存在，等待对方处理',
        'cannot send to self': '不能添加自己为好友',
        'user not found': '用户不存在',
      };
      setFriendError(map[msg] || msg);
    }
  };

  const handleGroupSearch = async () => {
    if (!groupSearchQuery.trim()) return;
    const users = await userApi.searchUsers(groupSearchQuery);
    setGroupSearchResults(users);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    await useChatStore.getState().createGroup(groupName.trim(), selectedMembers);
    closeCreateGroup();
    setGroupName('');
    setSelectedMembers([]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
  };

  const createGroupEnabled = !!groupName.trim() && selectedMembers.length > 0;

  return (
    <>
      {/* 搜索用户（加好友） */}
      <Modal open={showSearch} title="搜索用户" onClose={handleCloseAddFriend}>
        {friendError && (
          <div className="mb-3 rounded-md px-3 py-2 text-xs" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {friendError}
          </div>
        )}
        <div className="mb-4 flex gap-2">
          <Input
            className="flex-1"
            placeholder="输入用户名或昵称"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <Button variant="primary" onClick={handleSearch}>搜索</Button>
        </div>
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 260 }}>
          {searchResults.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md p-3 hoverable" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-3">
                <div className="ui-avatar" style={{ width: 36, height: 36, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{u.nickname?.[0] || u.username[0]}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {u.nickname || u.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {sentRequestIds.includes(u.id) ? (
                  <span className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--success)', color: '#fff' }}>
                    已发送
                  </span>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => handleSendFriendRequest(u.id)}>加好友</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => handleStartChat(u.id)}>聊天</Button>
              </div>
            </div>
          ))}
          {searchResults.length === 0 && searchQuery && (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>未找到用户</p>
          )}
        </div>
      </Modal>

      {/* 创建群聊 */}
      <Modal open={showCreateGroup} title="创建群聊" onClose={closeCreateGroup} width={440}>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>群名称</label>
          <Input className="w-full" placeholder="请输入群名称" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>添加成员</label>
          <div className="mb-3 flex gap-2">
            <Input
              className="flex-1"
              placeholder="搜索用户"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGroupSearch()}
            />
            <Button variant="secondary" onClick={handleGroupSearch}>搜索</Button>
          </div>
          {selectedMembers.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selectedMembers.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {id.slice(0, 6)}...
                  <button onClick={() => toggleMember(id)} className="cursor-pointer" aria-label="移除">
                    <CloseIcon size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 160 }}>
            {groupSearchResults.map((u) => {
              const isSelected = selectedMembers.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleMember(u.id)}
                  className="flex items-center justify-between rounded-md p-2.5 hoverable cursor-pointer"
                  style={{
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="ui-avatar" style={{ width: 28, height: 28, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{u.nickname?.[0] || u.username[0]}</span>
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.nickname || u.username}</span>
                  </div>
                  {isSelected && <CheckIcon size={16} className="text-[var(--accent)]" />}
                </div>
              );
            })}
          </div>
        </div>
        <Button block variant={createGroupEnabled ? 'primary' : 'secondary'} disabled={!createGroupEnabled} onClick={handleCreateGroup}>
          创建群聊 ({selectedMembers.length} 人)
        </Button>
      </Modal>

    </>
  );
}
