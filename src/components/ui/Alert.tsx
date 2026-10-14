import { forwardRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

type Variant = 'error' | 'warning' | 'neutral';

interface AlertProps {
  variant: Variant;
  title: string;
  icon: LucideIcon;
  /** Use "status" for passive information, "alert" for problems the person must act on. */
  role?: 'alert' | 'status';
  children: ReactNode;
}

const STYLES: Record<Variant, { box: string; icon: string }> = {
  error: { box: 'border-danger-soft bg-danger-surface text-danger-ink', icon: 'text-danger' },
  warning: { box: 'border-warning-soft bg-warning-surface text-warning-ink', icon: 'text-warning' },
  neutral: { box: 'border-charcoal-300 bg-white text-charcoal-900', icon: 'text-charcoal-700' },
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant, title, icon: Icon, role = 'alert', children },
  ref,
) {
  const styles = STYLES[variant];
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={-1}
      className={cx('flex items-start gap-3 rounded-control border p-4', styles.box)}
    >
      <Icon aria-hidden="true" className={cx('mt-0.5 h-5 w-5 shrink-0', styles.icon)} />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{children}</p>
      </div>
    </div>
  );
});