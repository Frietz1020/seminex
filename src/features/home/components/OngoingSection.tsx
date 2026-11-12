import type { SeminarListItem } from '../../../api/types';
import type { ResourceState } from '../../../hooks/useResource';
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
  if (ongoing.length === 0) return null;

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
