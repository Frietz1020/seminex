import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import { cx } from './cx';

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange' | 'required'> {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Fixed text shown after the typed value, for example the email domain. */
  suffix?: string;
  /** Absolutely positioned control inside the field, for example a show/hide button. */
  trailing?: ReactNode;
  onChange: (value: string) => void;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, required = false, hint, error, suffix, trailing, onChange, ...inputProps },
  ref,
) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const suffixId = `${id}-suffix`;
  const describedBy =
    [suffix ? suffixId : null, error ? errorId : hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className={cx('mb-2 block text-sm font-semibold', error ? 'text-danger-ink' : 'text-charcoal-900')}
      >
        {label}{' '}
        {required && (
          <span className={cx('text-xs font-normal', error ? 'text-danger' : 'text-charcoal-500')}>
            (Required)
          </span>
        )}
      </label>

      <div
        className={cx(
          'relative flex items-center rounded-control border shadow-control transition-colors',
          error
            ? 'border-danger-border bg-danger-surface/50 ring-2 ring-danger-border/20 focus-within:ring-danger-border/40'
            : 'border-charcoal-300 bg-white focus-within:border-maroon focus-within:ring-2 focus-within:ring-maroon/30',
        )}
      >
        <input
          {...inputProps}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cx(
            'min-w-0 flex-1 bg-transparent py-3 pl-3.5 text-base text-charcoal-900 outline-none placeholder:text-charcoal-300',
            suffix ? 'rounded-l-control pr-1' : trailing ? 'rounded-control pr-12' : 'rounded-control pr-3.5',
          )}
        />
        {suffix && (
          <span
            id={suffixId}
            className={cx(
              'select-none whitespace-nowrap border-l py-0.5 pl-2 pr-3 text-sm font-medium',
              error ? 'border-danger-soft text-danger' : 'border-charcoal-200 text-charcoal-500',
            )}
          >
            {suffix}
          </span>
        )}
        {trailing}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 flex items-start gap-1.5 text-sm text-charcoal-500">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
});