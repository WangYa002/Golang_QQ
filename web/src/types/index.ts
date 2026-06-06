export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
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
  type: 'text' | 'image' | 'file' | 'system';
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
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface WSMessage {
  type: string;
  data: unknown;
}

export interface AuthResponse {
  token: string;
  user: User;
}
