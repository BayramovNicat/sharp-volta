import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createDevServer } from "../vite";

describe("mattermost client app", () => {
  let server: Server<unknown>;
  let mockBackend: Server<unknown> | null = null;
  let webview: Bun.WebView;

  beforeAll(async () => {
    try {
      mockBackend = Bun.serve({
        port: 3000,
        fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === '/api/me') {
            return Response.json({ id: 'me', username: 'testuser' });
          }
          if (url.pathname === '/api/channels') {
            return Response.json([
              { id: 'ch-general', name: 'general', display_name: 'General', type: 'O' },
            ]);
          }
          if (url.pathname.includes('/posts')) {
            return Response.json({
              order: ['post-1'],
              posts: {
                'post-1': {
                  id: 'post-1',
                  user_id: 'me',
                  channel_id: 'ch-general',
                  message: 'Hello team',
                  create_at: Date.now(),
                },
              },
            });
          }
          return Response.json({});
        },
      });
    } catch {
      mockBackend = null;
    }

    server = createDevServer(0, false);
    webview = new Bun.WebView();
    await webview.navigate(`http://localhost:${server.port}`);
  });

  afterAll(async () => {
    await webview.close();
    server.stop(true);
    if (mockBackend) {
      mockBackend.stop(true);
    }
  });

  test("renders mattermost sidebar and search input", async () => {
    const state = (await webview.evaluate(`(async () => {
      let attempts = 0;
      while (!document.querySelector('#sidebar-search-input') && attempts < 50) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
      }
      return {
        hasSidebarSearch: !!document.querySelector('#sidebar-search-input'),
        hasMessageInput: !!document.querySelector('#chat-message-input'),
        hasApp: !!document.querySelector('#app'),
        title: document.title,
      };
    })()`)) as { hasSidebarSearch: boolean; hasMessageInput: boolean; hasApp: boolean; title: string };

    expect(state.hasApp).toBe(true);
    expect(state.hasSidebarSearch).toBe(true);
    expect(state.hasMessageInput).toBe(true);
    expect(state.title).not.toContain('%VITE_APP_TITLE%');
    expect(state.title).toContain('Sharp Volta');
  });

  test("preserves focus and updates input value when searching", async () => {
    const searchState = (await webview.evaluate(`(async () => {
      const input = document.querySelector('#sidebar-search-input');
      if (!input) return { focused: false, value: '' };
      input.focus();
      input.value = 'town-square';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 50));
      return {
        focused: document.activeElement === document.querySelector('#sidebar-search-input'),
        value: document.querySelector('#sidebar-search-input')?.value ?? '',
      };
    })()`)) as { focused: boolean; value: string };

    expect(searchState.focused).toBe(true);
    expect(searchState.value).toBe('town-square');
  });

  test("renders notification toggle button in header and handles click", async () => {
    const toggleState = (await webview.evaluate(`(async () => {
      const btn = document.querySelector('header button[title*="Notifications"]');
      if (!btn) return { exists: false, initialTitle: '', nextTitle: '' };
      const initialTitle = btn.getAttribute('title') || '';
      btn.click();
      await new Promise(r => setTimeout(r, 50));
      const updatedBtn = document.querySelector('header button[title*="Notifications"]');
      return {
        exists: true,
        initialTitle,
        nextTitle: updatedBtn?.getAttribute('title') || '',
      };
    })()`)) as { exists: boolean; initialTitle: string; nextTitle: string };

    expect(toggleState.exists).toBe(true);
    expect(toggleState.initialTitle).toContain('Notifications and audio chime enabled');
    expect(toggleState.nextTitle).toContain('Notifications and audio chime muted');
  });

  test("preserves message input content during typing indicator updates", async () => {
    const inputState = (await webview.evaluate(`(async () => {
      const textarea = document.querySelector('#chat-message-input');
      const typingEl = document.querySelector('#chat-typing-indicator');
      if (!textarea || !typingEl) return { textKept: false, typingUpdated: false };

      textarea.value = 'Draft message in progress';
      typingEl.textContent = 'Alice is typing...';
      await new Promise(r => setTimeout(r, 20));

      return {
        textKept: textarea.value === 'Draft message in progress',
        typingUpdated: typingEl.textContent === 'Alice is typing...',
      };
    })()`)) as { textKept: boolean; typingUpdated: boolean };

    expect(inputState.textKept).toBe(true);
    expect(inputState.typingUpdated).toBe(true);
  });

  test("submitting a message immediately renders optimistic post in sending state", async () => {
    const optimisticState = (await webview.evaluate(`(async () => {
      if (window.__hmr_state__) {
        window.__hmr_state__.activeChannelId = 'test-channel';
      }
      const form = document.querySelector('form');
      const textarea = document.querySelector('#chat-message-input');
      if (!form || !textarea) return { submitted: false, hasTempPost: false, isSending: false };

      textarea.value = 'Optimistic test message';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Synchronously / instantly check if temp post exists in DOM
      await new Promise(r => setTimeout(r, 20));
      const tempPost = document.querySelector('article[data-post-id^="temp_"]');
      const hasTempPost = !!tempPost;
      const isSending = tempPost?.textContent?.includes('Sending...') ?? false;

      return {
        submitted: true,
        hasTempPost,
        isSending,
      };
    })()`)) as { submitted: boolean; hasTempPost: boolean; isSending: boolean };

    expect(optimisticState.submitted).toBe(true);
    expect(optimisticState.hasTempPost).toBe(true);
    expect(optimisticState.isSending).toBe(true);
  });

  test("renders attachment button and activates drag-drop overlay", async () => {
    const uploadUiState = (await webview.evaluate(`(async () => {
      const attachBtn = document.querySelector('#chat-attachment-btn');
      const fileInput = document.querySelector('#chat-file-input');
      const form = document.querySelector('form');

      let inputClicked = false;
      if (fileInput) {
        fileInput.addEventListener('click', () => { inputClicked = true; }, { once: true });
      }

      attachBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Dispatch dragenter on the form
      const dragEvent = new Event('dragenter', { bubbles: true, cancelable: true });
      form?.dispatchEvent(dragEvent);
      await new Promise(r => setTimeout(r, 20));

      const overlay = form?.querySelector('div[class*="border-dashed"]');
      const isOverlayVisible = overlay && !overlay.classList.contains('hidden');

      return {
        hasAttachBtn: !!attachBtn,
        hasFileInput: !!fileInput,
        inputClicked,
        isOverlayVisible: !!isOverlayVisible,
      };
    })()`)) as {
      hasAttachBtn: boolean;
      hasFileInput: boolean;
      inputClicked: boolean;
      isOverlayVisible: boolean;
    };

    expect(uploadUiState.hasAttachBtn).toBe(true);
    expect(uploadUiState.hasFileInput).toBe(true);
    expect(uploadUiState.inputClicked).toBe(true);
    expect(uploadUiState.isOverlayVisible).toBe(true);
  });

  test("toggles sidebar visibility via header button, Cmd+B, and Cmd+K (no duplicate button on sidebar)", async () => {
    const toggleState = (await webview.evaluate(`(async () => {
      const headerBtn = document.querySelector('#sidebar-toggle-button');
      const collapseBtn = document.querySelector('#sidebar-collapse-button');
      const sidebar = document.querySelector('#chat-sidebar');

      const initialOpen = sidebar && !sidebar.classList.contains('-ml-70');

      // Click header button to collapse
      headerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));

      const afterHeaderClosed = sidebar?.classList.contains('-ml-70');
      const headerBtnCollapsedTitle = headerBtn?.getAttribute('title');

      // Click header toggle button again to restore
      headerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 20));

      const afterHeaderOpen = sidebar && !sidebar.classList.contains('-ml-70');

      // Test Cmd+B shortcut to toggle
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 20));

      const afterKeyboardClosed = sidebar?.classList.contains('-ml-70');

      // Test Cmd+K shortcut opens sidebar and focuses search
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 20));

      const afterCmdKOpen = sidebar && !sidebar.classList.contains('-ml-70');
      const searchFocused = document.activeElement === document.querySelector('#sidebar-search-input');

      return {
        hasHeaderBtn: !!headerBtn,
        hasCollapseBtn: !!collapseBtn,
        initialOpen: !!initialOpen,
        afterHeaderClosed: !!afterHeaderClosed,
        headerBtnCollapsedTitle: headerBtnCollapsedTitle || '',
        afterHeaderOpen: !!afterHeaderOpen,
        afterKeyboardClosed: !!afterKeyboardClosed,
        afterCmdKOpen: !!afterCmdKOpen,
        searchFocused: !!searchFocused,
      };
    })()`)) as {
      hasHeaderBtn: boolean;
      hasCollapseBtn: boolean;
      initialOpen: boolean;
      afterHeaderClosed: boolean;
      headerBtnCollapsedTitle: string;
      afterHeaderOpen: boolean;
      afterKeyboardClosed: boolean;
      afterCmdKOpen: boolean;
      searchFocused: boolean;
    };

    expect(toggleState.hasHeaderBtn).toBe(true);
    expect(toggleState.hasCollapseBtn).toBe(false);
    expect(toggleState.initialOpen).toBe(true);
    expect(toggleState.afterHeaderClosed).toBe(true);
    expect(toggleState.headerBtnCollapsedTitle).toContain('Show sidebar');
    expect(toggleState.afterHeaderOpen).toBe(true);
    expect(toggleState.afterKeyboardClosed).toBe(true);
    expect(toggleState.afterCmdKOpen).toBe(true);
    expect(toggleState.searchFocused).toBe(true);
  });

  test("renders extract button near notification and opens extract modal", async () => {
    const extractState = (await webview.evaluate(`(async () => {
      let attempts = 0;
      while (!document.querySelector('#extract-chat-button') && attempts < 40) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
      }

      const extractBtn = document.querySelector('#extract-chat-button');
      const notifBtn = document.querySelector('#notifications-toggle-button');
      if (!extractBtn || !notifBtn) {
        return { exists: false, isNearNotif: false, openedModal: false, hasContent: false, closedModal: false };
      }

      const isNearNotif = extractBtn.parentElement === notifBtn.parentElement;

      // Populate sample post into state and activate button
      if (window.__hmr_state__) {
        window.__hmr_state__.activeChannelId = 'test-channel';
        window.__hmr_state__.channels = [
          { id: 'test-channel', name: 'general', display_name: 'General', type: 'O' }
        ];
        window.__hmr_state__.posts = Array.from({ length: 25 }, (_, i) => ({
          id: 'post-test-' + i,
          user_id: 'user-1',
          channel_id: 'test-channel',
          message: 'Todo item ' + i + ': Detailed action items for the LLM prompt extraction.',
          create_at: Date.now() + i * 1000,
        }));
      }

      extractBtn.disabled = false;
      extractBtn.click();
      await new Promise(r => setTimeout(r, 60));

      const modal = document.querySelector('#extract-chat-modal');
      const openedModal = !!modal;
      const preview = modal?.querySelector('pre');
      const hasContent = (preview?.textContent?.length ?? 0) > 0;
      const hasScrollbar = (preview?.scrollHeight ?? 0) > (preview?.clientHeight ?? 0);
      const title = modal?.querySelector('#extract-modal-title')?.textContent || '';

      const closeBtn = document.querySelector('#extract-modal-close-button');
      closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 50));

      const closedModal = !document.querySelector('#extract-chat-modal');

      return {
        exists: true,
        isNearNotif,
        openedModal,
        hasContent,
        hasScrollbar,
        title,
        closedModal,
      };
    })()`)) as {
      exists: boolean;
      isNearNotif: boolean;
      openedModal: boolean;
      hasContent: boolean;
      hasScrollbar: boolean;
      title: string;
      closedModal: boolean;
    };

    expect(extractState.exists).toBe(true);
    expect(extractState.isNearNotif).toBe(true);
    expect(extractState.openedModal).toBe(true);
    expect(extractState.hasContent).toBe(true);
    expect(extractState.hasScrollbar).toBe(true);
    expect(extractState.title).toContain('Extract Chat Data for LLMs');
    expect(extractState.closedModal).toBe(true);
  });

  test("renders date dividers and groups consecutive messages from same user within 5 minutes", async () => {
    const groupingState = (await webview.evaluate(`(async () => {
      const today = new Date();
      const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0).getTime();
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 15, 0, 0).getTime();

      if (window.__hmr_state__) {
        window.__hmr_state__.posts = [
          {
            id: 'post-yesterday',
            user_id: 'user-1',
            channel_id: 'test-channel',
            message: 'Message from yesterday',
            create_at: yesterday,
          },
          {
            id: 'post-today-1',
            user_id: 'user-1',
            channel_id: 'test-channel',
            message: 'First message today',
            create_at: baseToday,
          },
          {
            id: 'post-today-2',
            user_id: 'user-1',
            channel_id: 'test-channel',
            message: 'Second message 2 minutes later (should be grouped)',
            create_at: baseToday + 2 * 60 * 1000,
          },
          {
            id: 'post-today-diff-user',
            user_id: 'user-2',
            channel_id: 'test-channel',
            message: 'Different user 1 min later (should NOT be grouped)',
            create_at: baseToday + 3 * 60 * 1000,
          },
          {
            id: 'post-today-hours-later',
            user_id: 'user-2',
            channel_id: 'test-channel',
            message: 'Same user 5 hours later (should NOT be grouped)',
            create_at: baseToday + 5 * 60 * 60 * 1000,
          },
        ];
      }

      if (window.__render_app__) {
        window.__render_app__();
      }

      await new Promise(r => setTimeout(r, 60));

      const dividers = document.querySelectorAll('[data-date-divider]');
      const pYesterday = document.querySelector('article[data-post-id="post-yesterday"]');
      const pToday1 = document.querySelector('article[data-post-id="post-today-1"]');
      const pToday2 = document.querySelector('article[data-post-id="post-today-2"]');
      const pDiffUser = document.querySelector('article[data-post-id="post-today-diff-user"]');
      const pHoursLater = document.querySelector('article[data-post-id="post-today-hours-later"]');

      return {
        dividerCount: dividers.length,
        hasYesterdayDivider: Array.from(dividers).some(d => d.textContent?.includes('Yesterday')),
        hasTodayDivider: Array.from(dividers).some(d => d.textContent?.includes('Today')),
        pToday1HasAvatar: !!pToday1?.querySelector('.size-9.rounded-full'),
        pToday1HasHeader: !!pToday1?.querySelector('header'),
        pToday2IsGrouped: !pToday2?.querySelector('.size-9.rounded-full') && !pToday2?.querySelector('header') && !!pToday2?.querySelector('.w-9'),
        pDiffUserHasAvatar: !!pDiffUser?.querySelector('.size-9.rounded-full'),
        pHoursLaterHasAvatar: !!pHoursLater?.querySelector('.size-9.rounded-full'),
      };
    })()`)) as {
      dividerCount: number;
      hasYesterdayDivider: boolean;
      hasTodayDivider: boolean;
      pToday1HasAvatar: boolean;
      pToday1HasHeader: boolean;
      pToday2IsGrouped: boolean;
      pDiffUserHasAvatar: boolean;
      pHoursLaterHasAvatar: boolean;
    };

    expect(groupingState.dividerCount).toBe(2);
    expect(groupingState.hasYesterdayDivider).toBe(true);
    expect(groupingState.hasTodayDivider).toBe(true);
    expect(groupingState.pToday1HasAvatar).toBe(true);
    expect(groupingState.pToday1HasHeader).toBe(true);
    expect(groupingState.pToday2IsGrouped).toBe(true);
    expect(groupingState.pDiffUserHasAvatar).toBe(true);
    expect(groupingState.pHoursLaterHasAvatar).toBe(true);
  });
});
