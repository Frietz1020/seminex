import { ICONS, type IconName } from './icons';
import { cx } from './cx';

// Pixel sizes used by the exports, mapped to Tailwind classes.
const SIZES = {
  14: 'h-3.5 w-3.5',
  16: 'h-4 w-4',
  18: 'h-[18px] w-[18px]',
  20: 'h-5 w-5',
  22: 'h-[22px] w-[22px]',
  24: 'h-6 w-6',
  26: 'h-[26px] w-[26px]',
  32: 'h-8 w-8',
} as const;

interface IconProps {
  name: IconName;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Decorative icon: hidden from assistive technology. Put the meaning in adjacent text or a label. */
export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:fill-current',
        SIZES[size],
        className,
      )}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}