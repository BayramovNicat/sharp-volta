import { describe, expect, test } from 'bun:test';
import {
  getNotificationPermission,
  isUserMentioned,
  showDesktopNotification,
} from '../src/services/notifications';
import { playMentionChime, playMessageChime } from '../src/services/sound';

describe('notification service', () => {
  test('detects direct user mentions', () => {
    expect(isUserMentioned('Hello @john, how are you?', 'john')).toBe(true);
    expect(isUserMentioned('@john check this out', 'john')).toBe(true);
    expect(isUserMentioned('Great work (@john)!', 'john')).toBe(true);
    expect(isUserMentioned('Can you review this? @JOHN', 'john')).toBe(true);
  });

  test('detects broadcast mentions (@all, @channel, @here)', () => {
    expect(isUserMentioned('FYI @all meeting starts in 5m', 'john')).toBe(true);
    expect(isUserMentioned('@channel please review PR #42', 'john')).toBe(true);
    expect(isUserMentioned('Is @here available?', 'john')).toBe(true);
  });

  test('ignores non-mentions and substrings', () => {
    expect(isUserMentioned('Contact support@example.com for help', 'example')).toBe(false);
    expect(isUserMentioned('Hey john, did you see this?', 'john')).toBe(false);
    expect(isUserMentioned('Look at @johnathan please', 'john')).toBe(false);
    expect(isUserMentioned('', 'john')).toBe(false);
    expect(isUserMentioned('Hello world', undefined)).toBe(false);
  });

  test('safely falls back when window/Notification is unavailable', () => {
    expect(getNotificationPermission()).toBe('denied');
    expect(
      showDesktopNotification({
        title: 'Test',
        body: 'Message',
      })
    ).toBeNull();
  });
});

describe('sound service', () => {
  test('executes chime functions safely in non-browser environments without error', () => {
    expect(() => playMessageChime()).not.toThrow();
    expect(() => playMentionChime()).not.toThrow();
  });
});
