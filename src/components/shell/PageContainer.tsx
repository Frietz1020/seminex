import type { ReactNode } from 'react';
import { cx } from '../ui/cx';

interface PageContainerProps {
  children: ReactNode;
  /**
   * "standard" is 1280px. "narrow" (1024px) suits a single column of cards or a form.
   * "reading" (720px) suits a page of plain text.
   */
  width?: 'standard' | 'narrow' | 'reading';
}

const WIDTHS = {
  standard: 'max-w-7xl',
  narrow: 'max-w-5xl',
  reading: 'max-w-[45rem]',
} as const;

/** Shared page width and padding, using the Available Seminars values. */
export function PageContainer({ children, width = 'standard' }: PageContainerProps) {
  return (
    <div className={cx('mx-auto flex w-full flex-col gap-space-xl px-gutter py-space-xl md:px-margin', WIDTHS[width])}>
      {children}
    </div>
  );
}