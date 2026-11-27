import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { cx } from './cx';

interface StateMessageProps {
  icon: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /** Use "alert" for errors so they are announced. */
  role?: 'alert' | 'status';
}

/** Panel for an empty or error state. Empty states should pass an action that names the next step. */
export function StateMessage({ icon, title, children, action, role }: StateMessageProps) {
  return (
    <div
      role={role}
      className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface-card px-space-lg py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-maroon-container text-primary ring-4 ring-maroon-container/40"
      >
        <Icon name={icon} size={26} />
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
      <p className="mt-2 max-w-md font-body-sm text-body-sm text-text-secondary">{children}</p>
      {action && <div className="mt-space-lg">{action}</div>}
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-lg bg-primary-container px-5 font-body-sm-medium text-body-sm-medium text-on-primary transition-colors hover:bg-maroon-dark"
    >
      Try again
    </button>
  );
}

/** One-line error for small sections. */
export function InlineError({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-space-md gap-y-space-xs rounded-lg bg-error-container px-space-md py-space-sm font-body-sm text-body-sm text-on-error-container"
    >
      <Icon name="info" size={18} />
      <span>{children}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center font-body-sm-medium text-body-sm-medium underline"
      >
        Try again
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('rounded-lg bg-surface-container-high motion-safe:animate-pulse', className)}
    />
  );
}

/** Announces loading to assistive technology; put Skeleton children inside. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}