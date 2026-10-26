export interface User {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  status?: 'online' | 'away' | 'dnd' | 'offline';
}

export interface FileAttachment {
  id: string;
  name: string;
  extension: string;
  size: number;
  mime_type: string;
  has_preview_image?: boolean;
  preview_url?: string;
}

export interface PendingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  mime_type: string;
  previewUrl?: string;
}

export interface PostAttachment {
  title?: string;
  text?: string;
  fallback?: string;
  pretext?: string;
  color?: string;
  author_name?: string;
}

export interface Post {
  id: string;
  user_id: string;
  channel_id: string;
  message: string;
  create_at: number;
  metadata?: {
    files?: FileAttachment[];
  };
  file_ids?: string[];
  props?: {
    attachments?: PostAttachment[];
    override_username?: string;
    from_bot?: string;
    from_plugin?: string;
  };
  status?: 'sending' | 'sent' | 'failed';
  tempId?: string;
}

export interface Channel {
  id: string;
  name: string;
  display_name: string;
  type: 'O' | 'P' | 'D' | 'G';
  header?: string;
  purpose?: string;
  last_post_at?: number;
  otherUser?: User;
}

export interface AppState {
  currentUser: User | null;
  channels: Channel[];
  searchTerm: string;
  activeChannelId: string | null;
  posts: Post[];
  oldestPostId: string | null;
  hasMoreOlderPosts: boolean;
  isLoadingOlder: boolean;
  isConnected: boolean;
  typingText: string;
  errorMessage?: string | null;
  unreadChannelIds: Set<string>;
  mentionChannelIds: Set<string>;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  isSidebarOpen: boolean;
}
