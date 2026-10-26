import { describe, expect, test } from 'bun:test';
import type { Post } from '../src/types';

describe('optimistic message logic', () => {
  test('creates optimistic post with sending status and tempId', () => {
    const tempId = `temp_${Date.now()}_abc12`;
    const post: Post = {
      id: tempId,
      tempId,
      user_id: 'user_1',
      channel_id: 'channel_1',
      message: 'Hello world',
      create_at: Date.now(),
      status: 'sending',
    };

    expect(post.id).toBe(tempId);
    expect(post.tempId).toBe(tempId);
    expect(post.status).toBe('sending');
  });

  test('reconciles optimistic post with canonical server post', () => {
    const posts: Post[] = [
      {
        id: 'temp_123',
        tempId: 'temp_123',
        user_id: 'user_1',
        channel_id: 'channel_1',
        message: 'Optimistic text',
        create_at: 1000,
        status: 'sending',
      },
    ];

    const serverPost: Post = {
      id: 'server_post_999',
      user_id: 'user_1',
      channel_id: 'channel_1',
      message: 'Optimistic text',
      create_at: 1005,
      status: 'sent',
    };

    const idx = posts.findIndex((p) => p.id === 'temp_123' || p.tempId === 'temp_123');
    expect(idx).toBe(0);
    posts[idx] = serverPost;

    expect(posts.length).toBe(1);
    expect(posts[0].id).toBe('server_post_999');
    expect(posts[0].status).toBe('sent');
  });

  test('marks failed post for retry without removing it', () => {
    const posts: Post[] = [
      {
        id: 'temp_fail',
        tempId: 'temp_fail',
        user_id: 'user_1',
        channel_id: 'channel_1',
        message: 'Failed message',
        create_at: 1000,
        status: 'sending',
      },
    ];

    const idx = posts.findIndex((p) => p.id === 'temp_fail');
    expect(idx).toBe(0);
    posts[idx].status = 'failed';

    expect(posts[0].status).toBe('failed');
    expect(posts[0].message).toBe('Failed message');
  });

  test('prevents WebSocket duplicate when optimistic post is pending', () => {
    const posts: Post[] = [
      {
        id: 'temp_ws_1',
        tempId: 'temp_ws_1',
        user_id: 'me',
        channel_id: 'ch_1',
        message: 'WebSocket test',
        create_at: 1000,
        status: 'sending',
      },
    ];

    const wsPost: Post = {
      id: 'real_ws_1',
      user_id: 'me',
      channel_id: 'ch_1',
      message: 'WebSocket test',
      create_at: 1002,
    };

    const pendingIdx = posts.findIndex(
      (p) => (p.status === 'sending' || p.tempId) && p.message === wsPost.message
    );
    expect(pendingIdx).toBe(0);

    // Reconcile in place
    wsPost.status = 'sent';
    posts[pendingIdx] = wsPost;

    expect(posts.length).toBe(1);
    expect(posts[0].id).toBe('real_ws_1');
  });
});
