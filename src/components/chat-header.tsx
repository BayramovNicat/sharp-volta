import type { Channel } from '../types';
import { formatChannelName } from '../utils/channel-name';
import {
  BellIcon,
  BellOffIcon,
  HashIcon,
  LockIcon,
  PanelLeftIcon,
  SparklesIcon,
} from './icons';

interface ChatHeaderProps {
  channel: Channel | undefined;
  notificationsActive: boolean;
  onToggleNotifications: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  loadedMessagesCount?: number;
  onExtractChat?: () => void;
}

export const ChatHeader = ({
  channel,
  notificationsActive,
  onToggleNotifications,
  isSidebarOpen,
  onToggleSidebar,
  loadedMessagesCount = 0,
  onExtractChat,
}: ChatHeaderProps) => {
  const isDm = channel?.type === 'D' || channel?.type === 'G';
  const user = channel?.otherUser;
  const details = formatChannelName(channel);

  return (
    <header class="h-14 px-4 sm:px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40 shrink-0 gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button
          id="sidebar-toggle-button"
          type="button"
          onClick={onToggleSidebar}
          class={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            isSidebarOpen
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              : 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
          }`}
          title={isSidebarOpen ? 'Hide sidebar (⌘B)' : 'Show sidebar (⌘B)'}
          aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <PanelLeftIcon class="size-4" />
        </button>

        {channel ? (
          <div class="flex items-center gap-3 min-w-0">
            <div class="size-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              {details.iconType === 'dm' ? (
                <span class="text-xs font-bold text-zinc-300">
                  {details.initial}
                </span>
              ) : details.iconType === 'lock' ? (
                <LockIcon class="size-4 text-zinc-300" />
              ) : (
                <HashIcon class="size-4 text-zinc-300" />
              )}
            </div>
            <div class="min-w-0">
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2 truncate">
                {details.displayName}
                {isDm && user?.display_name && user.display_name !== user.username && (
                  <span class="text-xs font-normal text-zinc-400">({user.display_name})</span>
                )}
              </h2>
              <p class="text-[11px] text-zinc-400 truncate">
                {details.secondaryText}
              </p>
            </div>
          </div>
        ) : (
          <h2 class="text-sm font-semibold text-zinc-400">Select a conversation</h2>
        )}
      </div>

      <div class="flex items-center gap-2">
        <button
          id="extract-chat-button"
          type="button"
          onClick={onExtractChat}
          disabled={!channel && loadedMessagesCount === 0}
          class={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            channel || loadedMessagesCount > 0
              ? 'text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800'
              : 'text-zinc-600 opacity-40 cursor-not-allowed'
          }`}
          title={
            channel || loadedMessagesCount > 0
              ? `Extract ${loadedMessagesCount} loaded message(s) for LLM (todos, tasks, media)`
              : 'Select a conversation to extract'
          }
          aria-label="Extract chat for LLM"
        >
          <SparklesIcon class="size-4" />
        </button>

        <button
          id="notifications-toggle-button"
          type="button"
          onClick={onToggleNotifications}
          class={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            notificationsActive
              ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
          title={
            notificationsActive
              ? 'Notifications and audio chime enabled (click to mute)'
              : 'Notifications and audio chime muted (click to enable)'
          }
        >
          {notificationsActive ? <BellIcon class="size-4" /> : <BellOffIcon class="size-4" />}
        </button>
      </div>
    </header>
  );
};
