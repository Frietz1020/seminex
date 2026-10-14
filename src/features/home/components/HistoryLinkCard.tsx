import { Link } from 'react-router-dom';
import type { SeminarListItem } from '../../../api/types';
import type { ResourceState } from '../../../hooks/useResource';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { errorText } from '../../../components/ui/errorText';
import { buildHistoryRecords, summarizeHistory } from '../../history/records';

interface HistoryLinkCardProps {
  state: ResourceState<SeminarListItem[]>;
  items: SeminarListItem[] | null;
  now: number;
  onRetry: () => void;
}

export function HistoryLinkCard({ state, items, now, onRetry }: HistoryLinkCardProps) {
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your seminar history">
        <Skeleton className="h-28 w-full rounded-xl" />
      </LoadingRegion>
    );
  }
  if (state.status === 'error') {
    return (
      <StateMessage
        role="alert"
        icon="info"
        title="Your seminar history could not be loaded"
        action={<RetryButton onClick={onRetry} />}
      >
        {errorText(state.code)}
      </StateMessage>
    );
  }

  // Same derivation as History and Profile, so the three always agree.
  const summary = summarizeHistory(buildHistoryRecords(items ?? [], now));
  const completed = summary.completed;
  const certificates = summary.ready;

  return (
    <Link
      to="/history"
      className="group flex w-full flex-col justify-between gap-space-md rounded-xl bg-surface-card p-space-lg shadow-card transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-space-md">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary-container"
        >
          <Icon name="history_edu" size={26} />
        </div>
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm text-on-surface">Recent seminar history</span>
          <span className="font-body-sm text-body-sm text-text-secondary">
            {completed === 0
              ? 'No completed seminars yet. Join a seminar to start your history.'
              : 'View completed records, download e-certificates, and track your milestones.'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-space-lg">
        <div className="flex items-center gap-space-md">
          <div className="flex flex-col text-left sm:text-right">
            <span className="font-headline-sm text-headline-sm text-on-surface">{completed}</span>
            <span className="font-caption text-caption text-text-subtle">Completed</span>
          </div>
          <div aria-hidden="true" className="h-8 w-px bg-border-subtle" />
          <div className="flex flex-col text-left sm:text-right">
            <span className="font-headline-sm text-headline-sm text-primary-container">{certificates}</span>
            <span className="font-caption text-caption text-text-subtle">Certificates available</span>
          </div>
        </div>
        <Icon
          name="chevron_right"
          size={24}
          className="text-text-subtle group-hover:text-primary-container motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}