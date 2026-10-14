import { cx } from './cx';

const TONES = {
  maroon: 'bg-primary-container',
  available: 'bg-status-available',
  ongoing: 'bg-status-ongoing',
  full: 'bg-status-full',
} as const;

interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name. Also put the meaning in visible text next to the bar. */
  label: string;
  tone?: keyof typeof TONES;
}

export function ProgressBar({ value, max, label, tone = 'maroon' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
    >
      <div
        className={cx('h-full rounded-full motion-safe:transition-[width]', TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}