import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { createDevServer } from '../vite';

describe('MessageList loaded messages retention', () => {
  let server: Server<unknown>;
  let webview: Bun.WebView;

  beforeAll(async () => {
    server = createDevServer(0, false);
    webview = new Bun.WebView();
    await webview.navigate(`http://localhost:${server.port}`);
  });

  afterAll(async () => {
    await webview.close();
    server.stop(true);
  });

  test('renders and retains all loaded messages in DOM without virtual unmounting during scroll', async () => {
    const result = (await webview.evaluate(`(async () => {
      if (window.__hmr_state__) {
        window.__hmr_state__.channels = [
          { id: 'ch-scroll-test', name: 'scroll-test', display_name: 'Scroll Test', type: 'O' }
        ];
        window.__hmr_state__.activeChannelId = 'ch-scroll-test';
        window.__hmr_state__.posts = Array.from({ length: 75 }, (_, i) => ({
          id: 'post-scroll-' + i,
          user_id: 'user-1',
          channel_id: 'ch-scroll-test',
          message: 'Persistent loaded message ' + i,
          create_at: Date.now() + i * 1000,
        }));
      }

      if (window.__render_app__) {
        window.__render_app__();
      }

      await new Promise(r => setTimeout(r, 60));

      const articlesInitial = document.querySelectorAll('article[data-post-id]');
      const initialCount = articlesInitial.length;
      const firstIdBeforeScroll = articlesInitial[0]?.getAttribute('data-post-id');
      const lastIdBeforeScroll = articlesInitial[articlesInitial.length - 1]?.getAttribute('data-post-id');

      // Find scroll container and scroll down
      const scrollContainer = document.querySelector('article[data-post-id]')?.closest('.overflow-y-auto');
      if (scrollContainer) {
        scrollContainer.scrollTop = 1500;
        scrollContainer.dispatchEvent(new Event('scroll'));
      }
      await new Promise(r => setTimeout(r, 60));

      const articlesAfterScroll = document.querySelectorAll('article[data-post-id]');
      const afterScrollCount = articlesAfterScroll.length;

      // Scroll back to top
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        scrollContainer.dispatchEvent(new Event('scroll'));
      }
      await new Promise(r => setTimeout(r, 60));

      const articlesTop = document.querySelectorAll('article[data-post-id]');

      return {
        initialCount,
        firstIdBeforeScroll,
        lastIdBeforeScroll,
        afterScrollCount,
        topCount: articlesTop.length,
        hasZeroSpacers: !document.querySelector('div[style*="height"]'),
      };
    })()`)) as {
      initialCount: number;
      firstIdBeforeScroll: string;
      lastIdBeforeScroll: string;
      afterScrollCount: number;
      topCount: number;
      hasZeroSpacers: boolean;
    };

    expect(result.initialCount).toBe(75);
    expect(result.firstIdBeforeScroll).toBe('post-scroll-0');
    expect(result.lastIdBeforeScroll).toBe('post-scroll-74');
    expect(result.afterScrollCount).toBe(75);
    expect(result.topCount).toBe(75);
    expect(result.hasZeroSpacers).toBe(true);
  });
});
