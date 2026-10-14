import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import { cx } from './cx';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Locks the button without removing it from the tab order, so focus is not lost. */
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
}

const BASE =
  'inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-control px-6 py-3 text-base font-medium shadow-control transition-colors disabled:cursor-not-allowed';

const IDLE: Record<Variant, string> = {
  primary:
    'bg-maroon text-white hover:bg-maroon-dark active:bg-maroon-dark disabled:bg-charcoal-200 disabled:text-charcoal-500',
  secondary:
    'border border-charcoal-300 bg-white text-charcoal-900 hover:border-charcoal-500 disabled:opacity-60',
};

const LOADING: Record<Variant, string> = {
  primary: 'cursor-wait bg-maroon/80 text-white',
  secondary: 'cursor-wait border border-charcoal-300 bg-white text-charcoal-900',
};

export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  icon,
  type = 'button',
  onClick,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cx(BASE, loading ? LOADING[variant] : IDLE[variant], className)}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}