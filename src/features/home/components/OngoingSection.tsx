import { Link } from 'react-router-dom';
import type { SeminarListItem } from '../../../api/types';
import type { ResourceState } from '../../../hooks/useResource';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { getStudentSeminarPlacement } from '../../../lib/seminarStatus';
import { OngoingSeminarCard } from './OngoingSeminarCard';

interface OngoingSectionProps {
  state: ResourceState<SeminarListItem[]>;
  items: SeminarListItem[] | null;
  now: number;
  onRetry: () => void;
}

/** Shows ongoing and recently finished registered seminars while the ticket can still be scanned. */
export function OngoingSection({ state, items, now, onRetry }: OngoingSectionProps) {
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your ongoing seminar">
        <Skeleton className="h-64 w-full rounded-xl" />
      </LoadingRegion>
    );
  }
  if (state.status === 'error') {
    return <InlineError onRetry={onRetry}>Your ongoing seminar could not be loaded.</InlineError>;
  }

  const ongoing = (items ?? []).filter((item) => item.registration !== null && getStudentSeminarPlacement(item.seminar, now) === 'home');
  if (ongoing.length === 0) {
    return (
      <section
        aria-labelledby="home-empty-heading"
        className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface-card px-space-lg py-12 text-center"
      >
        <div
          aria-hidden="true"
          className="mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-maroon-container text-primary ring-4 ring-maroon-container/40"
        >
          <Icon name="event_available" size={26} />
        </div>
        <h2 id="home-empty-heading" className="font-headline-sm text-headline-sm text-on-surface">
          No active seminars right now
        </h2>
        <p className="mt-2 max-w-md font-body-sm text-body-sm text-text-secondary">
          When you register for a live or upcoming seminar, your attendance progress and QR ticket will appear here.
        </p>
        <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm">
          <Link to="/seminars" className={actionPrimary}>
            <span>Browse available seminars</span>
            <Icon name="arrow_forward" size={18} />
          </Link>
          <Link to="/my-seminars" className={actionTonal}>
            <span>View my seminars</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-space-md">
      {ongoing.map((item) => (
        <OngoingSeminarCard
          key={item.seminar.id}
          seminar={item.seminar}
          registration={item.registration!}
          now={now}
        />
      ))}
    </div>
  );
}
