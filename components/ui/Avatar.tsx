'use client';

const AVATAR_COLORS = ['#ba81c5', '#a0c35a', '#b0c4ef', '#f9df6d', '#f4a261', '#e76f51'];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
}

export function Avatar({ src, name, size = 20 }: AvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const color = AVATAR_COLORS[hashString(name ?? '') % AVATAR_COLORS.length];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? 'Avatar'}
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center font-black select-none"
      style={{ width: size, height: size, backgroundColor: color, color: '#121213', fontSize: Math.max(10, size * 0.55) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}