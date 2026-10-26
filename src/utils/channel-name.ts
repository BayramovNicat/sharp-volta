import type { Channel, User } from '../types';

export interface ChannelNameDetails {
  title: string;
  displayName: string;
  secondaryText?: string;
  iconType: 'hash' | 'lock' | 'dm';
  initial: string;
}

export function formatChannelName(
  channel: Channel | undefined,
  usersMap?: Map<string, User>,
  currentUserId?: string
): ChannelNameDetails {
  if (!channel) {
    return {
      title: '',
      displayName: 'Select a conversation',
      iconType: 'hash',
      initial: '#',
    };
  }

  const isDm = channel.type === 'D' || channel.type === 'G';
  if (isDm) {
    let user = channel.otherUser;

    if (!user && usersMap && channel.name?.includes('__')) {
      const parts = channel.name.split('__');
      const otherId = parts.find((id) => id !== currentUserId);
      if (otherId && usersMap.has(otherId)) {
        user = usersMap.get(otherId);
      }
    }

    const username = user?.username;
    const fullName =
      user?.display_name && user.display_name !== username ? user.display_name : undefined;

    let title = 'Direct Message';
    let displayName = 'Direct Message';

    if (username && fullName) {
      title = `@${username} (${fullName})`;
      displayName = `@${username}`;
    } else if (username) {
      title = `@${username}`;
      displayName = `@${username}`;
    } else if (fullName) {
      title = fullName;
      displayName = fullName;
    } else if (channel.display_name && !channel.display_name.includes('__')) {
      const clean = channel.display_name.startsWith('@')
        ? channel.display_name
        : `@${channel.display_name}`;
      title = clean;
      displayName = clean;
    }

    const initial = (username || fullName || 'U').replace(/^@/, '').charAt(0).toUpperCase();

    return {
      title,
      displayName,
      secondaryText: user?.email || fullName || 'Direct Message',
      iconType: 'dm',
      initial,
    };
  }

  const isPrivate = channel.type === 'P';
  const rawName = channel.display_name || channel.name || 'Channel';
  const prefix = isPrivate ? '🔒 ' : '#';

  return {
    title: `${prefix}${rawName}`,
    displayName: rawName,
    secondaryText:
      channel.header || channel.purpose || (isPrivate ? 'Private Channel' : 'Public Channel'),
    iconType: isPrivate ? 'lock' : 'hash',
    initial: rawName.charAt(0).toUpperCase(),
  };
}
