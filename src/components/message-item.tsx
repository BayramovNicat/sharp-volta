import type { FileAttachment, Post, User } from '../types';
import { AlertCircleIcon, ClockIcon, PaperclipIcon } from './icons';

interface MessageItemProps {
  post: Post;
  author: User | undefined;
  isMe: boolean;
  onRetry?: (post: Post) => void;
}

const timeFormatter = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });

const INLINE_TOKEN_REGEX = /(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g;
const CODE_BLOCK_REGEX = /(```[\s\S]*?```)/g;
const TRIM_NEWLINES_REGEX = /^\n+|\n+$/g;

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = timeFormatter.format(date);
  return isToday ? `Today at ${time}` : `${dateFormatter.format(date)} at ${time}`;
};

const parseInlineElements = (text: string) => {
  const tokens = text.split(INLINE_TOKEN_REGEX);
  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code key={idx} class="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-indigo-300">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} class="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('http://') || token.startsWith('https://')) {
      return (
        <a key={idx} href={token} target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline break-all">
          {token}
        </a>
      );
    }
    return token;
  });
};

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const blocks = text.split(CODE_BLOCK_REGEX);
  return blocks.map((block, i) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const code = block.slice(3, -3).replace(TRIM_NEWLINES_REGEX, '');
      return (
        <pre key={i} class="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg text-xs font-mono my-2 overflow-x-auto max-w-full text-zinc-300">
          <code>{code}</code>
        </pre>
      );
    }
    return <span key={i} class="whitespace-pre-wrap">{parseInlineElements(block)}</span>;
  });
};

const extractMessageText = (post: Post): string => {
  if (post.message) return post.message;
  if (post.props?.attachments && post.props.attachments.length > 0) {
    return post.props.attachments
      .map((a) => [a.title, a.text || a.fallback || a.pretext].filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
};

export const MessageItem = ({ post, author, isMe, onRetry }: MessageItemProps) => {
  const authorName =
    post.props?.override_username ||
    author?.display_name ||
    author?.username ||
    'user';
  const initial = authorName.charAt(0).toUpperCase();
  const dateStr = formatTimestamp(post.create_at);
  const files: FileAttachment[] =
    post.metadata?.files && post.metadata.files.length > 0
      ? post.metadata.files
      : (post.file_ids || []).map((id) => ({
          id,
          name: 'Attachment',
          extension: '',
          size: 0,
          mime_type: 'image/jpeg',
        }));
  const isSending = post.status === 'sending';
  const isFailed = post.status === 'failed';
  const messageText = extractMessageText(post);

  const containerClasses = [
    'flex gap-3 items-start min-w-0 max-w-full px-2 py-1.5 -mx-2 rounded-lg transition-all group',
    isSending ? 'opacity-70' : 'hover:bg-zinc-800/30',
    isFailed ? 'border-l-2 border-rose-500 pl-2 bg-rose-500/5' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article data-post-id={post.id} class={containerClasses}>
      <div class="size-9 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center font-bold text-xs text-zinc-300 shrink-0">
        {initial}
      </div>

      <div class="grow min-w-0 max-w-full">
        <header class="flex items-baseline gap-2 mb-1 flex-wrap">
          <span class={`text-xs font-semibold ${isMe ? 'text-indigo-400' : 'text-zinc-100'}`}>
            {authorName}
          </span>
          {isSending ? (
            <span class="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <ClockIcon class="size-3 animate-pulse text-indigo-400" />
              <span>Sending...</span>
            </span>
          ) : isFailed ? (
            <span class="inline-flex items-center gap-1 text-[10px] text-rose-400 font-medium">
              <AlertCircleIcon class="size-3" />
              <span>Failed to send</span>
              <button
                type="button"
                onClick={() => onRetry?.(post)}
                class="text-indigo-400 hover:text-indigo-300 underline font-semibold ml-1 cursor-pointer"
              >
                Retry
              </button>
            </span>
          ) : (
            <time class="text-[10px] text-zinc-500 font-mono">{dateStr}</time>
          )}
        </header>

        {messageText && (
          <div class="text-xs text-zinc-200 leading-relaxed wrap-break-word">
            {renderFormattedText(messageText)}
          </div>
        )}

        {files.length > 0 && (
          <div class="mt-2.5 flex flex-wrap gap-2 max-w-full">
            {files.map((file) => {
              const fileUrl = file.preview_url || `/api/files/${file.id}`;
              const previewUrl = file.preview_url || `/api/files/${file.id}/preview`;

              if (file.mime_type?.startsWith('image/')) {
                return (
                  <a
                    key={file.id}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="max-w-xs max-h-56 rounded-lg overflow-hidden border border-zinc-800 bg-black cursor-pointer hover:border-indigo-500/50 transition-colors block"
                  >
                    <img
                      src={previewUrl}
                      alt={file.name}
                      loading="lazy"
                      class="size-full object-cover max-h-56"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={file.id}
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-xs hover:border-zinc-700 transition-colors"
                >
                  <PaperclipIcon class="size-4 text-zinc-400 shrink-0" />
                  <span class="text-zinc-200 truncate max-w-xs font-mono">{file.name}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};
