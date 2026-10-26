const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isUserMentioned = (message: string, currentUsername?: string): boolean => {
  if (!message) return false;
  const targets = ['all', 'channel', 'here'];
  if (currentUsername?.trim()) {
    targets.push(currentUsername.trim());
  }
  const pattern = new RegExp(
    `(?:^|[\\s([{"'])@(${targets.map(escapeRegex).join('|')})(?=$|[\\s)\\]}",.!?])`,
    'i'
  );
  return pattern.test(message);
};

export const getNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}

export const showDesktopNotification = ({
  title,
  body,
  tag,
  onClick,
}: DesktopNotificationOptions): Notification | null => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: '/favicon.ico',
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch {
    return null;
  }
};
