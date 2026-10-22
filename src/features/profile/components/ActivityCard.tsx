import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { actionTonal } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import type { SeminarListItem } from '../../../api/types';
import { buildHistoryRecords, summarizeHistory } from '../../history/records';

/** Counts come from the same history records as the History page, so the numbers always match. */
export function ActivityCard() {
  const now = useNow();
  const history = useResource(() => api.listHistory(), 'profile-history');

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
      <div className="flex items-center justify-between gap-space-sm">
        <h2 id="activity-heading" className="font-title-md text-title-md text-on-surface">
          Academic activity
        </h2>
      </div>

      {history.state.status === 'loading' ? (
        <LoadingRegion label="Loading your academic activity" className="grid grid-cols-3 gap-space-sm">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </LoadingRegion>
      ) : history.state.status === 'error' ? (
        <InlineError onRetry={history.reload}>
          Your academic activity could not be loaded. {errorText(history.state.code)}
        </InlineError>
      ) : (
        <ActivityCounts records={history.state.status === 'success' ? history.state.data : []} now={now} />
      )}
    </section>
  );
}

function ActivityCounts({ records: items, now }: { records: SeminarListItem[]; now: number }) {
  const summary = summarizeHistory(buildHistoryRecords(items, now));
  const tiles = [
    { label: 'Seminars attended', value: summary.attended, tone: 'text-primary' },
    { label: 'Certificates earned', value: summary.ready, tone: 'text-secondary' },
    { label: 'Evaluations pending', value: summary.evaluationsPending, tone: 'text-status-ongoing' },
  ];

  return (
    <>
      <dl className="grid grid-cols-3 gap-space-sm text-center">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col-reverse items-center justify-center gap-1 rounded-lg bg-surface-light p-3">
            <dt className="font-caption text-caption text-text-secondary">{tile.label}</dt>
            <dd className={`font-headline-md text-headline-md font-bold ${tile.tone}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>
      {summary.completed === 0 && (
        <div className="flex flex-col items-start gap-space-sm">
          <p className="font-body-sm text-body-sm text-text-secondary">
            No finished seminars yet. Your attended seminars and certificates appear here.
          </p>
          <Link to="/seminars" className={actionTonal}>
            Browse available seminars
          </Link>
        </div>
      )}
    </>
  );
}
