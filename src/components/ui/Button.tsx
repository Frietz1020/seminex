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
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-medium shadow-control transition duration-150 disabled:cursor-not-allowed';

const PRESSABLE = 'motion-safe:active:scale-[0.97]';

const IDLE: Record<Variant, string> = {
  primary:
    `${PRESSABLE} bg-primary-container text-on-primary hover:bg-maroon-dark active:bg-maroon-dark disabled:bg-charcoal-200 disabled:text-charcoal-500`,
  secondary:
    `${PRESSABLE} border border-charcoal-300 bg-white text-charcoal-900 hover:border-charcoal-500 disabled:opacity-60`,
};

const LOADING: Record<Variant, string> = {
  primary: 'cursor-wait bg-primary-container/80 text-on-primary',
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
