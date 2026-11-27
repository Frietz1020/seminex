import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'onChange' | 'required' | 'value'> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  /** Text of the empty first option, for example "Select your program". */
  placeholder: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, required = false, error, placeholder, options, value, onChange, ...selectProps },
  ref,
) {
  const errorId = `${id}-error`;

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

      <div className={cx('relative', error && 'motion-safe:animate-[field-invalid_180ms_ease-out]')}>
        <select
          {...selectProps}
          ref={ref}
          id={id}
          required={required}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cx(
            'w-full cursor-pointer appearance-none rounded-control border py-3 pl-3.5 pr-10 text-base shadow-control outline-none transition-colors',
            value === '' ? 'text-charcoal-500' : 'text-charcoal-900',
            error
              ? 'border-danger-border bg-danger-surface/50 ring-2 ring-danger-border/20 focus:ring-danger-border/40'
              : 'border-charcoal-300 bg-white focus:border-maroon focus:ring-2 focus:ring-maroon/30',
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-charcoal-900">
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="keyboard_arrow_down"
          size={20}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-500"
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
          <Icon name="error" size={16} className="mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
