import type { Channel, Post, User } from '../types';

export interface ExtractedMedia {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
  mimeType: string;
  size: number;
  formattedSize: string;
}

export interface ExtractedMessage {
  id: string;
  createAt: number;
  timestamp: string;
  authorName: string;
  username?: string;
  isCurrentUser: boolean;
  isBot: boolean;
  text: string;
  media: ExtractedMedia[];
  links: string[];
}

export interface ExtractedChatStats {
  totalLoadedMessages: number;
  totalMedia: number;
  participants: string[];
}

export interface ExtractedChat {
  channel: {
    id: string;
    name: string;
    displayName: string;
    type: string;
    header?: string;
    purpose?: string;
  };
  stats: ExtractedChatStats;
  messages: ExtractedMessage[];
  toMarkdown: (options?: { includePrompt?: boolean }) => string;
  toJSON: (options?: { includePrompt?: boolean }) => string;
}

const URL_REGEX = /https?:\/\/[^\s)\]>"']+/g;

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTimestamp = (timestamp: number): string => {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

export const extractMessageText = (post: Post): string => {
  const parts: string[] = [];
  if (post.message && post.message.trim().length > 0) {
    parts.push(post.message.trim());
  }

  if (post.props?.attachments && post.props.attachments.length > 0) {
    const attachmentTexts = post.props.attachments
      .map((a) => [a.title, a.text || a.fallback || a.pretext].filter(Boolean).join('\n'))
      .filter((t) => t.trim().length > 0);
    if (attachmentTexts.length > 0) {
      parts.push(attachmentTexts.join('\n\n'));
    }
  }

  return parts.join('\n\n');
};

const resolveBaseUrl = (overrideBaseUrl?: string): string => {
  if (overrideBaseUrl) return overrideBaseUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  O: 'Public Channel',
  P: 'Private Channel',
  D: 'Direct Message',
  G: 'Group Message',
};

export const extractChatData = (
  channel: Channel | undefined,
  posts: Post[],
  usersMap: Map<string, User>,
  currentUserId?: string,
  options?: { baseUrl?: string }
): ExtractedChat => {
  const baseUrl = resolveBaseUrl(options?.baseUrl);
  const participantsSet = new Set<string>();

  const chronologicalPosts = [...posts].sort((a, b) => a.create_at - b.create_at);

  let totalMediaCount = 0;

  const messages: ExtractedMessage[] = chronologicalPosts.map((post) => {
    const author = usersMap.get(post.user_id);
    const authorName =
      post.props?.override_username ||
      author?.display_name ||
      author?.username ||
      'user';

    const isBot = Boolean(post.props?.from_bot || post.props?.override_username);
    const isCurrentUser = Boolean(currentUserId && post.user_id === currentUserId);
    participantsSet.add(authorName);

    const text = extractMessageText(post);
    const linksMatches = text.match(URL_REGEX);
    const links = linksMatches ? Array.from(new Set(linksMatches)) : [];

    const media: ExtractedMedia[] = [];

    if (post.metadata?.files && post.metadata.files.length > 0) {
      for (const file of post.metadata.files) {
        media.push({
          id: file.id,
          name: file.name || `file-${file.id}`,
          url: file.preview_url || `${baseUrl}/api/files/${file.id}`,
          previewUrl: file.preview_url || `${baseUrl}/api/files/${file.id}/preview`,
          mimeType: file.mime_type || 'application/octet-stream',
          size: file.size || 0,
          formattedSize: formatFileSize(file.size || 0),
        });
      }
    } else if (post.file_ids && post.file_ids.length > 0) {
      for (const id of post.file_ids) {
        media.push({
          id,
          name: `Attachment-${id}`,
          url: `${baseUrl}/api/files/${id}`,
          previewUrl: `${baseUrl}/api/files/${id}/preview`,
          mimeType: 'application/octet-stream',
          size: 0,
          formattedSize: 'Unknown size',
        });
      }
    }

    totalMediaCount += media.length;

    return {
      id: post.id,
      createAt: post.create_at,
      timestamp: formatTimestamp(post.create_at),
      authorName,
      username: author?.username,
      isCurrentUser,
      isBot,
      text,
      media,
      links,
    };
  });

  const channelInfo = {
    id: channel?.id || 'unknown-channel',
    name: channel?.name || 'unknown',
    displayName: channel?.display_name || channel?.name || 'Channel',
    type: CHANNEL_TYPE_LABELS[channel?.type || 'O'] || 'Channel',
    header: channel?.header || undefined,
    purpose: channel?.purpose || undefined,
  };

  const stats: ExtractedChatStats = {
    totalLoadedMessages: messages.length,
    totalMedia: totalMediaCount,
    participants: Array.from(participantsSet),
  };

  const toMarkdown = ({ includePrompt = true }: { includePrompt?: boolean } = {}) => {
    const lines: string[] = [];

    lines.push(`# Chat Transcript: ${channelInfo.displayName}`);
    lines.push('');
    lines.push('## Channel Information');
    lines.push(`- **Channel**: ${channelInfo.displayName} (${channelInfo.type})`);
    if (channelInfo.header) {
      lines.push(`- **Header / Topic**: ${channelInfo.header}`);
    }
    if (channelInfo.purpose) {
      lines.push(`- **Purpose**: ${channelInfo.purpose}`);
    }
    lines.push(`- **Participants**: ${stats.participants.join(', ') || 'None'}`);
    lines.push(`- **Messages Loaded**: ${stats.totalLoadedMessages}`);
    lines.push(`- **Total Media Attachments**: ${stats.totalMedia}`);
    lines.push(`- **Extracted At**: ${new Date().toISOString()}`);
    lines.push('');

    if (includePrompt) {
      lines.push('## LLM Instructions: Action Items & Todo List');
      lines.push('You are an expert project manager and executive assistant. Based on the following chat transcript:');
      lines.push('1. **Extract all Action Items & Todos**: Create an organized Markdown checklist (`- [ ]`) grouped by assignee/person or workstream.');
      lines.push('2. **Include Deadlines & Priorities**: Note any deadlines, timeframes, or high-priority requests mentioned.');
      lines.push('3. **Reference Media & Links**: When an action item references an attached file or link, cite the URL directly.');
      lines.push('4. **Identify Blockers & Questions**: List open questions, pending feedback, or blockers requiring clarification.');
      lines.push('5. **Executive Summary**: Provide a 2-3 sentence overview of current project status or discussion outcome.');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## Chat Messages (Chronological)');
    lines.push('');

    if (messages.length === 0) {
      lines.push('_No messages loaded in this chat view._');
      return lines.join('\n');
    }

    for (const msg of messages) {
      const userTag = msg.username ? ` (@${msg.username})` : '';
      const botTag = msg.isBot ? ' [BOT]' : '';
      const meTag = msg.isCurrentUser ? ' [YOU]' : '';

      lines.push(`### [${msg.timestamp}] ${msg.authorName}${userTag}${botTag}${meTag}`);

      if (msg.text) {
        lines.push(msg.text);
      } else if (msg.media.length === 0) {
        lines.push('_[Empty message]_');
      }

      if (msg.media.length > 0) {
        lines.push('');
        lines.push('**Media Attachments**:');
        for (const file of msg.media) {
          lines.push(`- [${file.name}](${file.url}) (${file.mimeType}, ${file.formattedSize})`);
          if (file.mimeType.startsWith('image/')) {
            lines.push(`  - Direct Preview: ${file.previewUrl}`);
          }
        }
      }

      if (msg.links.length > 0) {
        lines.push('');
        lines.push('**Referenced Links**:');
        for (const link of msg.links) {
          lines.push(`- ${link}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  };

  const toJSON = ({ includePrompt = true }: { includePrompt?: boolean } = {}) => {
    const payload = {
      ...(includePrompt
        ? {
            system_prompt:
              'You are an expert assistant analyzing a team chat transcript. Extract all action items, create a structured todo list with assignees, deadlines, and references to media links, and summarize decisions and open questions.',
          }
        : {}),
      exported_at: new Date().toISOString(),
      channel: channelInfo,
      stats,
      messages: messages.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        author: {
          name: m.authorName,
          username: m.username,
          is_current_user: m.isCurrentUser,
          is_bot: m.isBot,
        },
        text: m.text,
        media: m.media.map((file) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          preview_url: file.previewUrl,
          mime_type: file.mimeType,
          size: file.size,
        })),
        links: m.links,
      })),
    };

    return JSON.stringify(payload, null, 2);
  };

  return {
    channel: channelInfo,
    stats,
    messages,
    toMarkdown,
    toJSON,
  };
};
