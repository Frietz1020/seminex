import type { OrgLifecycle } from '../seminarStatus';
import { Icon } from '../../../components/ui/Icon';

const STATUS: Record<OrgLifecycle, { label: string; icon: 'event' | 'schedule' | 'check_circle' | 'close'; className: string }> = {
  upcoming: { label: 'Upcoming', icon: 'event', className: 'bg-status-finished-container text-status-finished' },
  ongoing: { label: 'Ongoing', icon: 'schedule', className: 'bg-status-ongoing-container text-status-ongoing' },
  finished: { label: 'Finished', icon: 'check_circle', className: 'bg-status-available-container text-status-available' },
  cancelled: { label: 'Cancelled', icon: 'close', className: 'bg-danger-surface text-danger-ink' },
};

export function OrgStatusBadge({ status }: { status: OrgLifecycle }) {
  const config = STATUS[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-label-sm text-label-sm ${config.className}`}><Icon name={config.icon} size={14} />{config.label}</span>;
}
