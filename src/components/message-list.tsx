import type { Post, User } from '../types';
import { calculateVirtualWindow } from '../utils/virtual-window';
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

const DEFAULT_ITEM_HEIGHT = 64;
const VIRTUAL_THRESHOLD = 40;

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
  const heightCache = new Map<string, number>();
  let currentStartIndex = 0;
  let currentEndIndex = posts.length - 1;
  let containerEl: HTMLElement | null = null;
  let itemsContainerEl: HTMLElement | null = null;
  let topSpacerEl: HTMLElement | null = null;
  let bottomSpacerEl: HTMLElement | null = null;
  let loadingSpinnerEl: HTMLElement | null = null;

  const getItemHeight = (index: number): number => {
    const post = posts[index];
    if (!post) return DEFAULT_ITEM_HEIGHT;
    return heightCache.get(post.id) ?? DEFAULT_ITEM_HEIGHT;
  };

  const measureRenderedItems = () => {
    if (!itemsContainerEl) return;
    const articles = itemsContainerEl.querySelectorAll<HTMLElement>('article[data-post-id]');
    for (let i = 0; i < articles.length; i++) {
      const el = articles[i];
      const id = el.getAttribute('data-post-id');
      if (id && el.offsetHeight > 0) {
        heightCache.set(id, el.offsetHeight);
      }
    }
  };

  const renderPostSlice = (start: number, end: number) => {
    const slice = posts.slice(start, end + 1);
    const fragment = document.createDocumentFragment();
    for (const post of slice) {
      fragment.appendChild(
        <MessageItem
          key={post.id}
          post={post}
          author={usersMap.get(post.user_id)}
          isMe={post.user_id === currentUserId}
          onRetry={onRetry}
        />
      );
    }
    return fragment;
  };

  const updateWindow = () => {
    if (!containerEl || !itemsContainerEl || posts.length <= VIRTUAL_THRESHOLD) {
      return;
    }

    measureRenderedItems();

    const win = calculateVirtualWindow({
      totalCount: posts.length,
      getItemHeight,
      scrollTop: containerEl.scrollTop,
      clientHeight: containerEl.clientHeight || 700,
      overscanPx: 450,
    });

    if (topSpacerEl) {
      topSpacerEl.style.height = `${win.topSpacerHeight}px`;
    }
    if (bottomSpacerEl) {
      bottomSpacerEl.style.height = `${win.bottomSpacerHeight}px`;
    }

    if (win.startIndex !== currentStartIndex || win.endIndex !== currentEndIndex) {
      currentStartIndex = win.startIndex;
      currentEndIndex = win.endIndex;
      itemsContainerEl.replaceChildren(renderPostSlice(currentStartIndex, currentEndIndex));
    }
  };

  const handleContainerScroll = (e: Event) => {
    if (posts.length > VIRTUAL_THRESHOLD) {
      updateWindow();
    }
    onScroll?.(e);
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

      posts.push(post);

      if (posts.length <= VIRTUAL_THRESHOLD && itemsContainerEl) {
        itemsContainerEl.appendChild(
          <MessageItem
            key={post.id}
            post={post}
            author={usersMap.get(post.user_id)}
            isMe={post.user_id === currentUserId}
            onRetry={onRetry}
          />
        );
      } else {
        updateWindow();
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
            const newEl = (
              <MessageItem
                key={updatedPost.id}
                post={updatedPost}
                author={usersMap.get(updatedPost.user_id)}
                isMe={updatedPost.user_id === currentUserId}
                onRetry={onRetry}
              />
            );
            existingEl.replaceWith(newEl);
          } else if (posts.length > VIRTUAL_THRESHOLD) {
            updateWindow();
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
          const newEl = (
            <MessageItem
              key={serverPost.id}
              post={serverPost}
              author={usersMap.get(serverPost.user_id)}
              isMe={serverPost.user_id === currentUserId}
              onRetry={onRetry}
            />
          );
          existingEl.replaceWith(newEl);
        } else if (posts.length > VIRTUAL_THRESHOLD) {
          updateWindow();
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
            const newEl = (
              <MessageItem
                key={failedPost.id}
                post={failedPost}
                author={usersMap.get(failedPost.user_id)}
                isMe={failedPost.user_id === currentUserId}
                onRetry={onRetry}
              />
            );
            existingEl.replaceWith(newEl);
          } else if (posts.length > VIRTUAL_THRESHOLD) {
            updateWindow();
          }
        }
      }
    },

    prependPosts: (olderPosts: Post[], prevScrollHeight: number, prevScrollTop: number) => {
      posts.unshift(...olderPosts);
      if (posts.length <= VIRTUAL_THRESHOLD && itemsContainerEl) {
        const fragment = document.createDocumentFragment();
        for (const post of olderPosts) {
          fragment.appendChild(
            <MessageItem
              key={post.id}
              post={post}
              author={usersMap.get(post.user_id)}
              isMe={post.user_id === currentUserId}
              onRetry={onRetry}
            />
          );
        }
        itemsContainerEl.prepend(fragment);
      } else {
        updateWindow();
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

  const initialWin =
    posts.length > VIRTUAL_THRESHOLD
      ? calculateVirtualWindow({
          totalCount: posts.length,
          getItemHeight,
          scrollTop: 0,
          clientHeight: 700,
          overscanPx: 450,
        })
      : null;

  if (initialWin) {
    currentStartIndex = initialWin.startIndex;
    currentEndIndex = initialWin.endIndex;
  }

  return (
    <div
      ref={(el) => {
        containerEl = el;
        scrollRef?.(el);
      }}
      onScroll={handleContainerScroll}
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

      {posts.length > VIRTUAL_THRESHOLD ? (
        <div>
          <div
            ref={(el) => {
              topSpacerEl = el;
            }}
            style={`height: ${initialWin?.topSpacerHeight ?? 0}px;`}
          />
          <div
            ref={(el) => {
              itemsContainerEl = el;
            }}
            class="space-y-4"
          >
            {renderPostSlice(currentStartIndex, currentEndIndex)}
          </div>
          <div
            ref={(el) => {
              bottomSpacerEl = el;
            }}
            style={`height: ${initialWin?.bottomSpacerHeight ?? 0}px;`}
          />
        </div>
      ) : (
        <div
          ref={(el) => {
            itemsContainerEl = el;
          }}
          class="space-y-4"
        >
          {posts.map((post) => (
            <MessageItem
              key={post.id}
              post={post}
              author={usersMap.get(post.user_id)}
              isMe={post.user_id === currentUserId}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
};
