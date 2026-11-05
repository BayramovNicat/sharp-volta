interface UserAvatarProps {
  userId?: string;
  name?: string;
  avatarUrl?: string;
  sizeClass?: string;
  textClass?: string;
  class?: string;
  lastPictureUpdate?: number;
}

const AVATAR_PALETTES = [
  { bg: 'bg-indigo-600', text: 'text-indigo-100', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-500/30' },
  { bg: 'bg-sky-600', text: 'text-sky-100', border: 'border-sky-500/30' },
  { bg: 'bg-violet-600', text: 'text-violet-100', border: 'border-violet-500/30' },
  { bg: 'bg-teal-600', text: 'text-teal-100', border: 'border-teal-500/30' },
  { bg: 'bg-rose-600', text: 'text-rose-100', border: 'border-rose-500/30' },
  { bg: 'bg-cyan-600', text: 'text-cyan-100', border: 'border-cyan-500/30' },
];

export const getAvatarPalette = (
  identifier: string = ''
): { bg: string; text: string; border: string } => {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

export const UserAvatar = ({
  userId,
  name,
  avatarUrl: customAvatarUrl,
  sizeClass = 'size-9',
  textClass = 'text-xs',
  class: extraClass = '',
  lastPictureUpdate,
}: UserAvatarProps) => {
  const initial = (name || 'U').charAt(0).toUpperCase();
  const palette = getAvatarPalette(userId || name || 'default');

  // Only load remote avatar image when the user has an actual uploaded custom photo or bot icon
  const hasCustomPhoto = Boolean(
    customAvatarUrl || (lastPictureUpdate && lastPictureUpdate > 0)
  );

  const avatarUrl = hasCustomPhoto
    ? customAvatarUrl || `/api/users/${userId}/avatar?_=${lastPictureUpdate}`
    : null;

  return (
    <div
      class={`relative ${sizeClass} rounded-full overflow-hidden ${palette.bg} ${palette.border} border flex items-center justify-center font-bold ${textClass} ${palette.text} shrink-0 select-none shadow-xs ${extraClass}`}
    >
      <span class="select-none uppercase leading-none">{initial}</span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          loading="lazy"
          class="absolute inset-0 size-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
};
