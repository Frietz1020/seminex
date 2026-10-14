import { useState } from 'react';
import { cx } from './cx';

interface AvatarProps {
  /** Photo address. Without one, or if it fails to load, the initials show instead. */
  src?: string;
  firstName: string;
  lastName: string;
  size: 'sm' | 'xl';
  /** Leave empty when the person's name is written next to the avatar. */
  alt?: string;
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 font-label-sm text-label-sm',
  xl: 'h-28 w-28 font-headline-md text-headline-md',
} as const;

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

/** Photo avatar with an initials fallback. The same component serves the top bar and the profile. */
export function Avatar({ src, firstName, lastName, size, alt = '', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-on-primary',
        SIZES[size],
        className,
      )}
    >
      {showPhoto ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailedSrc(src ?? null)} />
      ) : (
        <span aria-hidden={alt === '' ? true : undefined} role={alt === '' ? undefined : 'img'} aria-label={alt === '' ? undefined : alt}>
          {initials(firstName, lastName)}
        </span>
      )}
    </span>
  );
}