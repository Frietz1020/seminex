import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import type { RecordStatus } from '../records';

const CONFIG: Record<RecordStatus, { label: string; icon: IconName; classes: string }> = {
  ready: {
    label: 'Certificate ready',
    icon: 'check_circle',
    classes: 'bg-status-available-container text-status-available',
  },
  evaluation_pending: {
    label: 'Evaluation not submitted',
    icon: 'pending_actions',
    classes: 'bg-status-ongoing-container text-status-ongoing',
  },
  below_minimum: {
    label: 'Attendance below minimum',
    icon: 'info',
    classes: 'bg-status-full-container text-status-full',
  },
  no_time_out: {
    label: 'No Time-Out recorded',
    icon: 'info',
    classes: 'bg-status-full-container text-status-full',
  },
  time_out_unvalidated: {
    label: 'Time-Out awaiting validation',
    icon: 'schedule',
    classes: 'bg-status-finished-container text-status-finished',
  },
};

export function recordStatusLabel(status: RecordStatus): string {
  return CONFIG[status].label;
}

/** The label is text; the icon is decoration. */
export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const config = CONFIG[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm',
        config.classes,
      )}
    >
      <Icon name={config.icon} size={14} />
      {config.label}
    </span>
  );
}