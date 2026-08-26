export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  bio: string;
  email: string;
  status: 'online' | 'offline' | 'away';
  role?: 'admin' | 'user' | '';
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  members: string[];
  group_id?: string;
  last_message?: LastMessage;
  created_at: string;
  updated_at: string;
}

export interface LastMessage {
  content: string;
  sender_id: string;
  type: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'file' | 'system' | 'recalled';
  content: string;
  metadata?: MessageMetadata;
  read_by: string[];
  created_at: string;
}

export interface MessageMetadata {
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface Group {
  id: string;
  name: string;
  avatar: string;
  owner_id: string;
  members: GroupMember[];
  max_members: number;
  announcement: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface GroupMemberWithUser {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: User;
}

export interface WSMessage {
  type: string;
  data: unknown;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface FriendRequest {
  id: string;
  from_user: User;
  to_user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Friend {
  id: string;
  user: User;
  remark: string;
  created_at: string;
}

/* ===== 管理后台 ===== */

export interface AdminStats {
  users: number;
  conversations: number;
  messages: number;
  groups: number;
  friends: number;
  friend_requests: number;
  pending_requests: number;
  online_users: number;
}

export interface AdminList<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface AdminMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  type: string;
  content: string;
  read_by: string[];
  created_at: string;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  avatar: string;
  owner_id: string;
  owner_name: string;
  member_count: number;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface AdminFriendRow {
  id: string;
  user_id: string;
  user_name: string;
  friend_id: string;
  friend_name: string;
  remark: string;
  created_at: string;
}

export interface AdminRequestRow {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  message: string;
  status: string;
  created_at: string;
}
