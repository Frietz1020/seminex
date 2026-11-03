import type { ReactNode } from 'react';
import { cx } from '../ui/cx';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /**
   * "standard" is 1280px. "narrow" (1024px) suits a single column of cards or a form.
   * "reading" (720px) suits a page of plain text.
   */
  width?: 'full' | 'standard' | 'narrow' | 'reading';
}

const WIDTHS = {
  full: 'max-w-none',
  standard: 'max-w-7xl',
  narrow: 'max-w-5xl',
  reading: 'max-w-[45rem]',
} as const;

/** Shared page width and padding, using the Available Seminars values. */
export function PageContainer({ children, width = 'standard', className }: PageContainerProps) {
  return (
    <div className={cx('mx-auto flex w-full min-w-0 flex-col gap-space-xl px-gutter py-space-xl md:px-margin', WIDTHS[width], className)}>
      {children}
    </div>
  );
}
