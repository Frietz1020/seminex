import { cx } from '../../../components/ui/cx';

interface AttendanceMeterProps {
  /** Whole percent, or null when attendance cannot be counted. */
  percent: number | null;
  /** True when the percentage reaches the required minimum. */
  met: boolean;
}

/** Ring with the percentage written inside it as text (12px), so the value never depends on color. */
export function AttendanceMeter({ percent, met }: AttendanceMeterProps) {
  const value = percent ?? 0;
  return (
    <div
      role="img"
      aria-label={percent === null ? 'Attendance not counted' : `Attendance ${percent} percent`}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <svg aria-hidden="true" viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" className="stroke-surface-container-high" />
        {percent !== null && value > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${value} ${100 - value}`}
            className={met ? 'stroke-status-available' : 'stroke-status-full'}
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className={cx(
          'absolute font-caption text-caption font-bold',
          percent !== null && !met ? 'text-status-full' : 'text-on-surface',
        )}
      >
        {percent === null ? 'N/A' : `${percent}%`}
      </span>
    </div>
  );
}