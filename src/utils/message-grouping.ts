import type { Post } from '../types';

export const GROUPING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (Slack / Mattermost standard)

export const isSameDay = (ts1: number, ts2: number): boolean => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const getDateKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const fullDateFormatter = new Intl.DateTimeFormat([], {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export const formatDateDivider = (timestamp: number, referenceDate: Date = new Date()): string => {
  const date = new Date(timestamp);

  const isToday =
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate();
  if (isToday) return 'Today';

  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';

  return fullDateFormatter.format(date);
};

export const shouldGroupPosts = (
  prevPost: Post | undefined,
  currentPost: Post,
  thresholdMs: number = GROUPING_THRESHOLD_MS
): boolean => {
  if (!prevPost) return false;

  // Must be from the same user
  if (prevPost.user_id !== currentPost.user_id) return false;

  // If override_username is present, they must match
  const prevOverride = prevPost.props?.override_username;
  const currOverride = currentPost.props?.override_username;
  if (prevOverride !== currOverride) return false;

  // Must be on the same calendar day
  if (!isSameDay(prevPost.create_at, currentPost.create_at)) return false;

  // Time difference must be within threshold (e.g. 5 minutes)
  const diff = currentPost.create_at - prevPost.create_at;
  if (diff < 0 || diff > thresholdMs) return false;

  // Do not group system messages
  if (currentPost.type?.startsWith('system_') || prevPost.type?.startsWith('system_')) {
    return false;
  }

  return true;
};
