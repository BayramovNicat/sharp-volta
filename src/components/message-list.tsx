import type { Post, User } from '../types';
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

  const createItem = (post: Post) => (
    <MessageItem
      key={post.id}
      post={post}
      author={usersMap.get(post.user_id)}
      isMe={post.user_id === currentUserId}
      onRetry={onRetry}
    />
  );

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

      posts.push(post);
      if (itemsContainerEl) {
        itemsContainerEl.appendChild(createItem(post));
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
            existingEl.replaceWith(createItem(updatedPost));
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
          existingEl.replaceWith(createItem(serverPost));
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
            existingEl.replaceWith(createItem(failedPost));
          }
        }
      }
    },

    prependPosts: (olderPosts: Post[], prevScrollHeight: number, prevScrollTop: number) => {
      posts.unshift(...olderPosts);
      if (itemsContainerEl) {
        const fragment = document.createDocumentFragment();
        for (const post of olderPosts) {
          fragment.appendChild(createItem(post));
        }
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
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4"
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
        class="space-y-4"
      >
        {posts.map((post) => createItem(post))}
      </div>
    </div>
  );
};
