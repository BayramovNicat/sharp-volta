import type { Post, User } from '../types';
import {
  formatDateDivider,
  getDateKey,
  isSameDay,
  shouldGroupPosts,
} from '../utils/message-grouping';
import { MessageSquareIcon, SpinnerIcon } from './icons';
import { MessageItem } from './message-item';

export interface MessageListHandle {
  appendPost: (post: Post) => void;
  updatePost: (post: Post) => void;
  reconcilePost: (tempId: string, serverPost: Post) => void;
  markPostFailed: (tempId: string) => void;
  prependPosts: (posts: Post[], prevScrollHeight: number, prevScrollTop: number) => void;
  setLoadingOlder: (loading: boolean) => void;
  scrollToBottom: () => void;
  getScrollContainer: () => HTMLElement | null;
}

interface MessageListProps {
  posts: Post[];
  usersMap: Map<string, User>;
  currentUserId: string | undefined;
  isLoadingOlder: boolean;
  hasMoreOlderPosts: boolean;
  onScroll?: (e: Event) => void;
  scrollRef?: (el: HTMLElement | null) => void;
  handleRef?: (handle: MessageListHandle | null) => void;
  onRetry?: (post: Post) => void;
}

export const DateDivider = ({ timestamp }: { timestamp: number }) => {
  const dateKey = getDateKey(timestamp);
  const label = formatDateDivider(timestamp);
  return (
    <div
      data-date-divider={dateKey}
      class="relative flex items-center justify-center my-4 py-1 select-none"
    >
      <div class="absolute inset-0 flex items-center" aria-hidden="true">
        <div class="w-full border-t border-zinc-800/80" />
      </div>
      <div class="relative px-3.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full text-[11px] font-medium text-zinc-400 shadow-xs tracking-wide">
        {label}
      </div>
    </div>
  );
};

export const MessageList = ({
  posts: initialPosts,
  usersMap,
  currentUserId,
  isLoadingOlder,
  hasMoreOlderPosts,
  onScroll,
  scrollRef,
  handleRef,
  onRetry,
}: MessageListProps) => {
  if (initialPosts.length === 0) {
    scrollRef?.(null);
    handleRef?.(null);
    return (
      <div class="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-6">
        <MessageSquareIcon class="size-8 opacity-40" />
        <p class="text-xs">No messages yet. Send a message to start the conversation!</p>
      </div>
    );
  }

  const posts = [...initialPosts];
  let containerEl: HTMLElement | null = null;
  let itemsContainerEl: HTMLElement | null = null;
  let loadingSpinnerEl: HTMLElement | null = null;

  const createItem = (post: Post, isGrouped: boolean = false) => (
    <MessageItem
      key={post.id}
      post={post}
      author={usersMap.get(post.user_id)}
      isMe={post.user_id === currentUserId}
      isGrouped={isGrouped}
      onRetry={onRetry}
    />
  );

  const isPostGroupedAtIndex = (index: number): boolean => {
    if (index <= 0) return false;
    return shouldGroupPosts(posts[index - 1], posts[index]);
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (containerEl) {
        containerEl.scrollTop = containerEl.scrollHeight;
      }
    });
  };

  const handle: MessageListHandle = {
    appendPost: (post: Post) => {
      if (posts.some((p) => p.id === post.id)) return;
      const isNearBottom =
        containerEl &&
        containerEl.scrollTop + containerEl.clientHeight >= containerEl.scrollHeight - 100;

      const lastPost = posts[posts.length - 1];
      const needsDivider = !lastPost || !isSameDay(lastPost.create_at, post.create_at);
      const isGrouped = shouldGroupPosts(lastPost, post);

      posts.push(post);
      if (itemsContainerEl) {
        if (needsDivider) {
          itemsContainerEl.appendChild(<DateDivider timestamp={post.create_at} />);
        }
        itemsContainerEl.appendChild(createItem(post, isGrouped));
      }

      if (isNearBottom) {
        scrollToBottom();
      }
    },

    updatePost: (updatedPost: Post) => {
      const idx = posts.findIndex((p) => p.id === updatedPost.id);
      if (idx !== -1) {
        posts[idx] = updatedPost;
        if (itemsContainerEl) {
          const existingEl = itemsContainerEl.querySelector(`article[data-post-id="${updatedPost.id}"]`);
          if (existingEl) {
            const isGrouped = isPostGroupedAtIndex(idx);
            existingEl.replaceWith(createItem(updatedPost, isGrouped));
          }
        }
      } else {
        handle.appendPost(updatedPost);
      }
    },

    reconcilePost: (tempId: string, serverPost: Post) => {
      const idx = posts.findIndex((p) => p.id === tempId || p.tempId === tempId);
      if (idx !== -1) {
        posts[idx] = serverPost;
      } else if (!posts.some((p) => p.id === serverPost.id)) {
        posts.push(serverPost);
      }

      if (itemsContainerEl) {
        const existingEl = itemsContainerEl.querySelector(`article[data-post-id="${tempId}"]`);
        if (existingEl) {
          const targetIdx = posts.findIndex((p) => p.id === serverPost.id);
          const isGrouped = isPostGroupedAtIndex(targetIdx);
          existingEl.replaceWith(createItem(serverPost, isGrouped));
        }
      }
    },

    markPostFailed: (tempId: string) => {
      const idx = posts.findIndex((p) => p.id === tempId || p.tempId === tempId);
      if (idx !== -1) {
        posts[idx].status = 'failed';
        const failedPost = posts[idx];
        if (itemsContainerEl) {
          const existingEl = itemsContainerEl.querySelector(`article[data-post-id="${tempId}"]`);
          if (existingEl) {
            const isGrouped = isPostGroupedAtIndex(idx);
            existingEl.replaceWith(createItem(failedPost, isGrouped));
          }
        }
      }
    },

    prependPosts: (olderPosts: Post[], prevScrollHeight: number, prevScrollTop: number) => {
      if (olderPosts.length === 0) return;

      const previouslyFirstPost = posts[0];
      const fragment = document.createDocumentFragment();
      let prev: Post | undefined = undefined;
      let lastDateKey = '';

      for (let i = 0; i < olderPosts.length; i++) {
        const post = olderPosts[i];
        const dateKey = getDateKey(post.create_at);
        if (dateKey !== lastDateKey) {
          fragment.appendChild(<DateDivider timestamp={post.create_at} />);
          lastDateKey = dateKey;
          prev = undefined;
        }
        const isGrouped = shouldGroupPosts(prev, post);
        fragment.appendChild(createItem(post, isGrouped));
        prev = post;
      }

      // Check boundary between olderPosts and previouslyFirstPost
      if (previouslyFirstPost && itemsContainerEl) {
        const lastOlderPost = olderPosts[olderPosts.length - 1];
        const prevFirstDateKey = getDateKey(previouslyFirstPost.create_at);

        if (prevFirstDateKey === lastDateKey) {
          const redundantDivider = itemsContainerEl.querySelector(
            `[data-date-divider="${prevFirstDateKey}"]`
          );
          if (redundantDivider) {
            redundantDivider.remove();
          }
          if (shouldGroupPosts(lastOlderPost, previouslyFirstPost)) {
            const existingFirstArticle = itemsContainerEl.querySelector(
              `article[data-post-id="${previouslyFirstPost.id}"]`
            );
            if (existingFirstArticle) {
              existingFirstArticle.replaceWith(createItem(previouslyFirstPost, true));
            }
          }
        }
      }

      posts.unshift(...olderPosts);
      if (itemsContainerEl) {
        itemsContainerEl.prepend(fragment);
      }

      requestAnimationFrame(() => {
        if (containerEl) {
          containerEl.scrollTop =
            containerEl.scrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    },

    setLoadingOlder: (loading: boolean) => {
      if (loadingSpinnerEl) {
        loadingSpinnerEl.style.display = loading ? 'flex' : 'none';
      }
    },

    scrollToBottom,
    getScrollContainer: () => containerEl,
  };

  handleRef?.(handle);

  return (
    <div
      ref={(el) => {
        containerEl = el;
        scrollRef?.(el);
      }}
      onScroll={onScroll}
      class="flex-1 overflow-y-auto overflow-x-hidden p-6"
    >
      <div
        ref={(el) => {
          loadingSpinnerEl = el;
        }}
        class={`py-2 flex items-center justify-center gap-2 text-xs text-zinc-500 ${
          isLoadingOlder ? 'flex' : 'hidden'
        }`}
      >
        <SpinnerIcon class="size-3.5 text-indigo-400" />
        <span>Loading older messages...</span>
      </div>

      {!hasMoreOlderPosts && (
        <div class="text-center py-4 border-b border-dashed border-zinc-800/80 mb-2">
          <span class="text-[11px] text-zinc-500 font-mono tracking-wider uppercase">
            Beginning of message history
          </span>
        </div>
      )}

      <div
        ref={(el) => {
          itemsContainerEl = el;
        }}
        class="flex flex-col min-w-0"
      >
        {(() => {
          const elements: HTMLElement[] = [];
          let prev: Post | undefined = undefined;
          let lastDateKey = '';

          for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            const dateKey = getDateKey(post.create_at);
            if (dateKey !== lastDateKey) {
              elements.push(<DateDivider timestamp={post.create_at} /> as HTMLElement);
              lastDateKey = dateKey;
              prev = undefined;
            }
            const isGrouped = shouldGroupPosts(prev, post);
            elements.push(createItem(post, isGrouped) as HTMLElement);
            prev = post;
          }
          return elements;
        })()}
      </div>
    </div>
  );
};
