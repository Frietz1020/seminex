import logoUrl from '../../assets/brand/logo.png';
import { cx } from '../ui/cx';

interface BrandMarkProps {
  /** Rendered width and height in pixels. */
  size?: number;
  className?: string;
  /** "onDark" is for the maroon auth panel. The artwork is the same; the value is kept on the element so
   *  a surface-specific treatment can be added here without touching callers. */
  variant?: 'default' | 'onDark';
}

/**
 * The Seminex logo, and the only place the logo file is imported. The mark has no wordmark, so callers
 * always place it beside the visible "Seminex" text. That makes it decorative, hence the empty alt.
 */
export function BrandMark({ size = 32, className, variant = 'default' }: BrandMarkProps) {
  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      draggable={false}
      data-variant={variant}
      style={{ width: size, height: size }}
      className={cx('shrink-0 select-none object-contain', className)}
    />
  );
}
