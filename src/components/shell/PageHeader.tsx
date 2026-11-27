import type { ReactNode } from 'react';
import { cx } from '../ui/cx';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Compact inline metadata pill displayed next to the title. */
  meta?: ReactNode;
  /** Right-aligned primary/secondary actions. */
  actions?: ReactNode;
  className?: string;
}

/** Uniform page header shared across Student Portal views for consistent typography and visual anchoring. */
export function PageHeader({ title, subtitle, meta, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cx(
        'flex flex-col justify-between gap-space-md border-b border-border-subtle pb-space-lg lg:flex-row lg:items-end',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-space-md gap-y-2">
          <h1 className="font-headline-xl text-headline-xl-mobile tracking-[-0.02em] text-on-surface md:text-headline-xl">
            {title}
          </h1>
          {meta}
        </div>
        {subtitle && (
          <div className="max-w-2xl font-body-base text-body-base text-text-secondary">
            {subtitle}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-space-sm">
          {actions}
        </div>
      )}
    </header>
  );
}
