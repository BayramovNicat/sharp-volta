import { describe, expect, test } from 'bun:test';
import type { Post, User } from '../src/types';
import {
  GROUPING_THRESHOLD_MS,
  formatDateDivider,
  getDateKey,
  isSameDay,
  shouldGroupPosts,
} from '../src/utils/message-grouping';

describe('Message Grouping & Date Divider Logic', () => {
  const baseTime = new Date('2026-11-04T12:00:00Z').getTime();

  const userA: User = {
    id: 'user-a',
    username: 'albug',
    email: 'albug@example.com',
  };

  const userB: User = {
    id: 'user-b',
    username: 'nicat',
    email: 'nicat@example.com',
  };

  test('groups consecutive posts from same author sent within 5 minutes', () => {
    const post1: Post = {
      id: 'p1',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Hello!',
      create_at: baseTime,
    };

    const post2: Post = {
      id: 'p2',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Second message 2 minutes later',
      create_at: baseTime + 2 * 60 * 1000, // +2 min
    };

    expect(shouldGroupPosts(post1, post2)).toBe(true);
  });

  test('does NOT group posts from same author when gap exceeds 5 minutes (e.g. 10 min, 4-5 hours)', () => {
    const post1: Post = {
      id: 'p1',
      user_id: userB.id,
      channel_id: 'ch1',
      message: 'Initial update',
      create_at: baseTime,
    };

    const postTenMinLater: Post = {
      id: 'p2',
      user_id: userB.id,
      channel_id: 'ch1',
      message: 'Update 10 minutes later',
      create_at: baseTime + 10 * 60 * 1000,
    };

    const postFiveHoursLater: Post = {
      id: 'p3',
      user_id: userB.id,
      channel_id: 'ch1',
      message: 'Followup 5 hours later',
      create_at: baseTime + 5 * 60 * 60 * 1000,
    };

    expect(shouldGroupPosts(post1, postTenMinLater)).toBe(false);
    expect(shouldGroupPosts(post1, postFiveHoursLater)).toBe(false);
  });

  test('does NOT group posts when sent by different users', () => {
    const post1: Post = {
      id: 'p1',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Hey',
      create_at: baseTime,
    };

    const post2: Post = {
      id: 'p2',
      user_id: userB.id,
      channel_id: 'ch1',
      message: 'Hey back',
      create_at: baseTime + 30 * 1000, // 30 sec later
    };

    expect(shouldGroupPosts(post1, post2)).toBe(false);
  });

  test('does NOT group posts across different calendar days even if close in time', () => {
    const lateNight = new Date('2026-11-04T23:59:00').getTime();
    const earlyMorning = new Date('2026-11-05T00:01:00').getTime();

    const post1: Post = {
      id: 'p1',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Good night',
      create_at: lateNight,
    };

    const post2: Post = {
      id: 'p2',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Wait, one more thing',
      create_at: earlyMorning,
    };

    expect(isSameDay(lateNight, earlyMorning)).toBe(false);
    expect(shouldGroupPosts(post1, post2)).toBe(false);
  });

  test('does NOT group system messages', () => {
    const post1: Post = {
      id: 'p1',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'joined the channel',
      type: 'system_join_channel',
      create_at: baseTime,
    };

    const post2: Post = {
      id: 'p2',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Hello everyone!',
      create_at: baseTime + 30 * 1000,
    };

    expect(shouldGroupPosts(post1, post2)).toBe(false);
  });

  test('does NOT group posts with different override bot usernames', () => {
    const post1: Post = {
      id: 'p1',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Bot 1 message',
      create_at: baseTime,
      props: { override_username: 'WebhookBotA' },
    };

    const post2: Post = {
      id: 'p2',
      user_id: userA.id,
      channel_id: 'ch1',
      message: 'Bot 2 message',
      create_at: baseTime + 60 * 1000,
      props: { override_username: 'WebhookBotB' },
    };

    expect(shouldGroupPosts(post1, post2)).toBe(false);
  });

  test('formatDateDivider returns Today and Yesterday relative to reference date', () => {
    const ref = new Date('2026-11-05T14:00:00');
    const todayTs = new Date('2026-11-05T09:00:00').getTime();
    const yesterdayTs = new Date('2026-11-04T20:00:00').getTime();
    const olderTs = new Date('2026-11-01T12:00:00').getTime();

    expect(formatDateDivider(todayTs, ref)).toBe('Today');
    expect(formatDateDivider(yesterdayTs, ref)).toBe('Yesterday');
    expect(formatDateDivider(olderTs, ref)).toContain('November');
  });

  test('generates consistent date keys for grouping', () => {
    const ts1 = new Date('2026-11-04T08:30:00').getTime();
    const ts2 = new Date('2026-11-04T23:45:00').getTime();
    const ts3 = new Date('2026-11-05T01:00:00').getTime();

    expect(getDateKey(ts1)).toBe('2026-11-04');
    expect(getDateKey(ts2)).toBe('2026-11-04');
    expect(getDateKey(ts3)).toBe('2026-11-05');
  });
});
