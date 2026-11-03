import type { OrgLifecycle } from '../seminarStatus';
import { Icon } from '../../../components/ui/Icon';

const STATUS: Record<OrgLifecycle, { label: string; icon: 'event' | 'schedule' | 'check_circle' | 'close'; className: string }> = {
  upcoming: { label: 'Upcoming', icon: 'event', className: 'bg-[#EDF2F7] text-[#4A5568]' },
  ongoing: { label: 'Ongoing', icon: 'schedule', className: 'bg-[#FDEEE4] text-[#9E4307]' },
  finished: { label: 'Finished', icon: 'check_circle', className: 'bg-[#E8F5EC] text-[#1E6B37]' },
  cancelled: { label: 'Cancelled', icon: 'close', className: 'bg-[#FEF2F2] text-[#BA1A1A]' },
};

export function OrgStatusBadge({ status }: { status: OrgLifecycle }) {
  const config = STATUS[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-label-sm text-label-sm ${config.className}`}><Icon name={config.icon} size={14} />{config.label}</span>;
}
