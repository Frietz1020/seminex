import type { RefObject } from 'react';
import { Icon } from '../ui/Icon';
import { cx } from '../ui/cx';

export interface StepItem<T extends number> {
  step: T;
  label: string;
}

interface StepProgressProps<T extends number> {
  steps: readonly StepItem<T>[];
  current: T;
  disabled?: boolean;
  onSelect: (step: T) => void;
  focusRef?: RefObject<HTMLElement | null>;
}

/** Conventional horizontal progress stepper with circular numbered nodes and connecting track. */
export function StepProgress<T extends number>({
  steps,
  current,
  disabled = false,
  onSelect,
  focusRef,
}: StepProgressProps<T>) {
  return (
    <nav
      ref={focusRef}
      tabIndex={-1}
      aria-label="Registration progress"
      className="mb-6 outline-none"
    >
      <ol className="flex items-center">
        {steps.map((item, index) => {
          const active = current === item.step;
          const complete = current > item.step;
          const isLast = index === steps.length - 1;

          return (
            <li key={item.step} className={cx('flex items-center', !isLast && 'flex-1')}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(item.step)}
                aria-current={active ? 'step' : undefined}
                className="group flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-label-sm text-label-sm tabular-nums transition-colors',
                    complete
                      ? 'bg-status-available text-on-primary'
                      : active
                        ? 'bg-primary-container text-on-primary ring-4 ring-maroon-container'
                        : 'border border-outline-variant bg-surface-card text-text-subtle group-hover:border-outline',
                  )}
                >
                  {complete ? <Icon name="check" size={16} /> : item.step}
                </span>
                <span
                  className={cx(
                    'whitespace-nowrap font-body-sm-medium text-body-sm-medium transition-colors',
                    active
                      ? 'text-on-surface'
                      : complete
                        ? 'text-primary'
                        : 'text-text-subtle group-hover:text-on-surface-variant',
                  )}
                >
                  {item.label}
                </span>
              </button>

              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cx(
                    'mx-3 h-0.5 flex-1 rounded-full transition-colors',
                    complete ? 'bg-primary-container' : 'bg-border-subtle',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
