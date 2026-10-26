import { describe, expect, it } from 'bun:test';
import type { Channel, User } from '../src/types';
import { formatChannelName } from '../src/utils/channel-name';

describe('formatChannelName', () => {
  const usersMap = new Map<string, User>([
    ['u2', { id: 'u2', username: 'carol', display_name: 'Carol Danvers' }],
  ]);

  it('formats public channel names with # prefix', () => {
    const channel: Channel = {
      id: 'c1',
      name: 'general',
      display_name: 'General',
      type: 'O',
    };
    const details = formatChannelName(channel);
    expect(details.title).toBe('#General');
    expect(details.displayName).toBe('General');
    expect(details.iconType).toBe('hash');
  });

  it('formats private channel names with lock prefix', () => {
    const channel: Channel = {
      id: 'c2',
      name: 'core-team',
      display_name: 'Core Team',
      type: 'P',
    };
    const details = formatChannelName(channel);
    expect(details.title).toBe('🔒 Core Team');
    expect(details.displayName).toBe('Core Team');
    expect(details.iconType).toBe('lock');
  });

  it('formats direct message with username and display_name', () => {
    const channel: Channel = {
      id: 'dm1',
      name: 'u1__u2',
      display_name: '',
      type: 'D',
      otherUser: {
        id: 'u2',
        username: 'alice',
        display_name: 'Alice Johnson',
      },
    };
    const details = formatChannelName(channel);
    expect(details.title).toBe('@alice (Alice Johnson)');
    expect(details.displayName).toBe('@alice');
    expect(details.iconType).toBe('dm');
    expect(details.initial).toBe('A');
  });

  it('formats direct message with username only', () => {
    const channel: Channel = {
      id: 'dm2',
      name: 'u1__u3',
      display_name: '',
      type: 'D',
      otherUser: {
        id: 'u3',
        username: 'bob',
      },
    };
    const details = formatChannelName(channel);
    expect(details.title).toBe('@bob');
    expect(details.displayName).toBe('@bob');
  });

  it('resolves direct message otherUser from usersMap when channel object lacks otherUser', () => {
    const channel: Channel = {
      id: 'dm3',
      name: 'u1__u2',
      display_name: 'u1__u2', // raw Mattermost hash
      type: 'D',
    };
    const details = formatChannelName(channel, usersMap, 'u1');
    expect(details.title).toBe('@carol (Carol Danvers)');
    expect(details.displayName).toBe('@carol');
    expect(details.initial).toBe('C');
  });

  it('never outputs raw user ID hash in direct message title', () => {
    const channel: Channel = {
      id: 'dm4',
      name: '4zcbqmopw7dapgcewhb7rce1wa__c4x8q91238912',
      display_name: '',
      type: 'D',
    };
    const details = formatChannelName(channel);
    expect(details.title).not.toContain('4zcbqmopw7dapgcewhb7rce1wa');
    expect(details.title).toBe('Direct Message');
  });

  it('handles undefined channel gracefully', () => {
    const details = formatChannelName(undefined);
    expect(details.title).toBe('');
    expect(details.displayName).toBe('Select a conversation');
  });

  it('generates expected browser title for channels and DMs with mention badges', () => {
    const appTitle = 'Sharp Volta (Mattermost)';
    const channel: Channel = {
      id: 'c1',
      name: 'announcements',
      display_name: 'Announcements',
      type: 'O',
    };
    const details = formatChannelName(channel);
    const regularDocTitle = `${details.title} · ${appTitle}`;
    expect(regularDocTitle).toBe('#Announcements · Sharp Volta (Mattermost)');

    const mentionBadge = '(2) ';
    const mentionDocTitle = `${mentionBadge}${details.title} · ${appTitle}`;
    expect(mentionDocTitle).toBe('(2) #Announcements · Sharp Volta (Mattermost)');

    const dmChannel: Channel = {
      id: 'dm1',
      name: 'u1__u2',
      display_name: '',
      type: 'D',
      otherUser: { id: 'u2', username: 'carol', display_name: 'Carol Danvers' },
    };
    const dmDetails = formatChannelName(dmChannel);
    const dmDocTitle = `${mentionBadge}${dmDetails.title} · ${appTitle}`;
    expect(dmDocTitle).toBe('(2) @carol (Carol Danvers) · Sharp Volta (Mattermost)');
  });
});
