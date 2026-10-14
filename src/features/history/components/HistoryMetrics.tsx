import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import type { HistorySummary } from '../records';

function Metric({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-space-sm px-space-sm">
      <span aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <div className="flex flex-col-reverse">
        <dt className="font-caption text-caption text-text-secondary">{label}</dt>
        <dd className="font-headline-sm text-headline-sm font-bold leading-tight text-on-surface">{value}</dd>
      </div>
    </div>
  );
}

/** Both numbers are computed from the records, never typed in. */
export function HistoryMetrics({ summary }: { summary: HistorySummary }) {
  return (
    <dl className="flex items-center gap-space-md self-start rounded-lg bg-surface-card p-space-md shadow-card">
      <Metric
        icon="workspace_premium"
        value={`${summary.ready} / ${summary.completed}`}
        label="Certificates ready"
        tone="bg-maroon-container text-primary"
      />
      <div aria-hidden="true" className="h-8 w-px bg-surface-container-high" />
      <Metric
        icon="assignment_turned_in"
        value={summary.averageAttendance === null ? 'None yet' : `${summary.averageAttendance}%`}
        label="Average attendance"
        tone="bg-surface-container text-secondary"
      />
    </dl>
  );
}