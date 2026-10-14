import { cx } from './cx';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group. */
  legend: string;
  /** Radio group name; must be unique on the page. */
  name: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * One choice from a short list. Built on native radio inputs, so arrow keys and screen reader
 * announcements work without extra code. The selected option also differs by weight and surface,
 * not by color alone.
 */
export function SegmentedControl<T extends string>({ legend, name, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-lg bg-surface-container p-1">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cx(
                'flex min-h-11 min-w-16 cursor-pointer items-center justify-center rounded-md px-4 font-body-sm-medium text-body-sm-medium text-text-secondary transition-colors',
                'hover:text-on-surface peer-checked:bg-surface-card peer-checked:font-semibold peer-checked:text-primary peer-checked:shadow-card',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-container',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}