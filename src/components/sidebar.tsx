import type { Channel, User } from '../types';
import { formatChannelName } from '../utils/channel-name';
import { HashIcon, LockIcon, PanelLeftIcon, SearchIcon } from './icons';

interface SidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  unreadChannelIds: Set<string>;
  mentionChannelIds: Set<string>;
  currentUser: User | null;
  isConnected: boolean;
  searchTerm: string;
  isSidebarOpen?: boolean;
  usersMap?: Map<string, User>;
  onToggleSidebar?: () => void;
  onSearchChange: (term: string) => void;
  onSelectChannel: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  dnd: 'bg-rose-500',
  offline: 'bg-zinc-600',
};

export const Sidebar = ({
  channels,
  activeChannelId,
  unreadChannelIds,
  mentionChannelIds,
  currentUser,
  isConnected,
  searchTerm,
  isSidebarOpen = true,
  usersMap,
  onToggleSidebar,
  onSearchChange,
  onSelectChannel,
}: SidebarProps) => {
  const term = searchTerm.trim().toLowerCase();
  const dms: Channel[] = [];
  const regularChannels: Channel[] = [];

  for (const ch of channels) {
    if (term) {
      const formatted = formatChannelName(ch, usersMap, currentUser?.id);
      const name = formatted.displayName.toLowerCase();
      const title = formatted.title.toLowerCase();
      const secondary = (formatted.secondaryText || '').toLowerCase();
      if (!name.includes(term) && !title.includes(term) && !secondary.includes(term)) {
        continue;
      }
    }
    if (ch.type === 'D' || ch.type === 'G') {
      dms.push(ch);
    } else if (ch.type === 'O' || ch.type === 'P') {
      regularChannels.push(ch);
    }
  }

  const myInitial = (currentUser?.username || 'U').charAt(0).toUpperCase();

  return (
    <aside
      id="chat-sidebar"
      aria-hidden={!isSidebarOpen}
      class={`w-70 bg-zinc-900 border-r border-zinc-800/80 flex flex-col shrink-0 select-none overflow-x-hidden transition-[margin] duration-200 ease-in-out ${
        isSidebarOpen ? 'ml-0' : '-ml-70 pointer-events-none'
      }`}
    >
      <div class="h-14 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
        <div class="font-bold text-sm tracking-tight text-zinc-100 truncate">
          Mattermost
        </div>
        <div class="flex items-center gap-1.5">
          <div
            id="connection-status-badge"
            class={`text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium ${
              isConnected
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            <span
              id="connection-status-dot"
              class={`size-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span id="connection-status-text">
              {isConnected ? 'Connected' : 'Reconnecting'}
            </span>
          </div>
          {onToggleSidebar && (
            <button
              id="sidebar-collapse-button"
              type="button"
              onClick={onToggleSidebar}
              class="size-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Hide sidebar (⌘B)"
              aria-label="Hide sidebar"
            >
              <PanelLeftIcon class="size-4" />
            </button>
          )}
        </div>
      </div>

      <div class="p-2.5 border-b border-zinc-800/60">
        <div class="relative flex items-center">
          <SearchIcon class="size-4 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            id="sidebar-search-input"
            type="text"
            placeholder="Filter channels & DMs (⌘K)"
            value={searchTerm}
            onInput={(e) => {
              const val = (e.currentTarget as HTMLInputElement).value;
              onSearchChange(val);
            }}
            class="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
        <section class="space-y-1">
          <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-2 py-1">
            Direct Messages
          </div>
          {dms.map((ch) => {
            const formatted = formatChannelName(ch, usersMap, currentUser?.id);
            const user: User = ch.otherUser || {
              id: ch.id,
              username: formatted.displayName.replace(/^@/, ''),
              display_name: formatted.displayName.replace(/^@/, ''),
              status: 'offline',
            };
            const initial = formatted.initial;
            const isActive = ch.id === activeChannelId;
            const isMentioned = mentionChannelIds.has(ch.id);
            const isUnread = unreadChannelIds.has(ch.id);
            const statusColor = STATUS_COLORS[user.status || 'offline'] ?? 'bg-zinc-600';
            const searchIndex = `${formatted.displayName} ${formatted.title} ${formatted.secondaryText || ''}`.toLowerCase();
            const displayNameText = user.display_name && user.display_name !== user.username
              ? user.display_name
              : formatted.displayName;

            return (
              <button
                type="button"
                key={ch.id}
                data-channel-id={ch.id}
                data-search-terms={searchIndex}
                onClick={() => onSelectChannel(ch.id)}
                class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : isMentioned
                      ? 'text-rose-200 font-semibold bg-rose-500/10 hover:bg-rose-500/20'
                      : isUnread
                        ? 'text-zinc-100 font-semibold hover:bg-zinc-800/60'
                        : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                }`}
              >
                <div class="relative size-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-semibold text-zinc-200 shrink-0">
                  {initial}
                  <span
                    data-user-status={user.id}
                    class={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-zinc-900 ${statusColor}`}
                  />
                </div>
                <span class="truncate grow">
                  {displayNameText}
                </span>
                <span data-badge-for={ch.id} class="ml-auto flex items-center shrink-0">
                  {isMentioned ? (
                    <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 leading-none">
                      @
                    </span>
                  ) : isUnread ? (
                    <span class="size-2 rounded-full bg-indigo-500 shrink-0" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </section>

        <section class="space-y-1">
          <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-2 py-1">
            Channels
          </div>
          {regularChannels.map((ch) => {
            const formatted = formatChannelName(ch, usersMap, currentUser?.id);
            const isActive = ch.id === activeChannelId;
            const isMentioned = mentionChannelIds.has(ch.id);
            const isUnread = unreadChannelIds.has(ch.id);
            const searchIndex = `${formatted.displayName} ${formatted.title}`.toLowerCase();

            return (
              <button
                type="button"
                key={ch.id}
                data-channel-id={ch.id}
                data-search-terms={searchIndex}
                onClick={() => onSelectChannel(ch.id)}
                class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : isMentioned
                      ? 'text-rose-200 font-semibold bg-rose-500/10 hover:bg-rose-500/20'
                      : isUnread
                        ? 'text-zinc-100 font-semibold hover:bg-zinc-800/60'
                        : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                }`}
              >
                <span class="size-4 text-zinc-400 flex items-center justify-center shrink-0">
                  {ch.type === 'P' ? (
                    <LockIcon class="size-3.5" />
                  ) : (
                    <HashIcon class="size-3.5" />
                  )}
                </span>
                <span class="truncate grow">{formatted.displayName}</span>
                <span data-badge-for={ch.id} class="ml-auto flex items-center shrink-0">
                  {isMentioned ? (
                    <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 leading-none">
                      @
                    </span>
                  ) : isUnread ? (
                    <span class="size-2 rounded-full bg-indigo-500 shrink-0" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </section>
      </div>

      <footer class="h-15 px-3.5 border-t border-zinc-800/80 flex items-center gap-3 bg-zinc-950/70">
        <div class="relative size-8.5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm shadow-indigo-600/30">
          {myInitial}
          <span class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />
        </div>
        <div class="grow min-w-0">
          <div class="text-xs font-semibold text-zinc-100 truncate leading-tight">
            @{currentUser?.username || 'user'}
          </div>
          <div class="text-[11px] text-zinc-400 truncate leading-tight mt-0.5">
            {currentUser?.email || (isConnected ? 'Online' : 'Reconnecting...')}
          </div>
        </div>
      </footer>
    </aside>
  );
};
