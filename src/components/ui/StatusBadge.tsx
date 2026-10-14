import type { SeminarStatus } from '../../features/seminars/status';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { cx } from './cx';

interface BadgeConfig {
  label: string;
  icon: IconName | 'dot';
  classes: string;
}

/** "upcoming" is only shown where a list separates seminars by schedule, such as My seminars. */
export type BadgeStatus = SeminarStatus | 'upcoming';

// The one place that maps a status to its label, icon, and token colors.
const CONFIG: Record<BadgeStatus, BadgeConfig> = {
  upcoming: { label: 'Upcoming', icon: 'event', classes: 'bg-secondary-container text-secondary' },
  available: { label: 'Available', icon: 'group', classes: 'bg-status-available-container text-status-available' },
  full: { label: 'Full', icon: 'lock', classes: 'bg-status-full-container text-status-full' },
  ongoing: { label: 'Ongoing', icon: 'dot', classes: 'bg-status-ongoing-container text-status-ongoing' },
  finished: {
    label: 'Finished',
    icon: 'check_circle',
    classes: 'bg-status-finished-container text-status-finished',
  },
  registered: {
    label: 'Registered',
    icon: 'check_circle',
    classes: 'bg-status-available-container text-status-available',
  },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  shape?: 'tag' | 'pill';
  /** Adds a shadow for badges that sit on top of an image. */
  elevated?: boolean;
}

/** The label is always text. The icon and the pulsing dot are decorative. */
export function StatusBadge({ status, shape = 'tag', elevated = false }: StatusBadgeProps) {
  const config = CONFIG[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 font-label-sm text-label-sm uppercase',
        shape === 'pill' ? 'rounded-full' : 'rounded-md',
        elevated && 'shadow-card',
        config.classes,
      )}
    >
      {config.icon === 'dot' ? (
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-status-ongoing motion-safe:animate-pulse" />
      ) : (
        <Icon name={config.icon} size={14} />
      )}
      {config.label}
    </span>
  );
}