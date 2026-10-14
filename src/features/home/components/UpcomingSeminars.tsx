import { Link } from 'react-router-dom';
import type { SeminarListItem } from '../../../api/types';
import type { ResourceState } from '../../../hooks/useResource';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { errorText } from '../../../components/ui/errorText';
import { SeminarCard } from '../../seminars/components/SeminarCard';
import { getLifecycle } from '../../seminars/status';

const MAX_CARDS = 3;

interface UpcomingSeminarsProps {
  state: ResourceState<SeminarListItem[]>;
  items: SeminarListItem[] | null;
  now: number;
  pendingId: string | null;
  onRegister: (seminarId: string) => void;
  onRetry: () => void;
}

export function UpcomingSeminars({ state, items, now, pendingId, onRegister, onRetry }: UpcomingSeminarsProps) {
  const upcoming = (items ?? [])
    .filter((item) => getLifecycle(item.seminar, now) === 'upcoming')
    .sort((a, b) => Date.parse(a.seminar.startsAt) - Date.parse(b.seminar.startsAt))
    .slice(0, MAX_CARDS);

  const browseAction = (
    <Link to="/seminars" className={actionPrimary}>
      Browse available seminars
    </Link>
  );

  let content;
  if (state.status === 'loading') {
    content = (
      <LoadingRegion label="Loading upcoming seminars">
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-96 rounded-xl" />
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (state.status === 'error') {
    content = (
      <StateMessage
        role="alert"
        icon="info"
        title="Upcoming seminars could not be loaded"
        action={<RetryButton onClick={onRetry} />}
      >
        {errorText(state.code)}
      </StateMessage>
    );
  } else if (upcoming.length === 0) {
    content = (
      <StateMessage icon="event_available" title="No upcoming seminars yet" action={browseAction}>
        New seminars will appear here once they are scheduled. Check the full list to see what is open.
      </StateMessage>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
        {upcoming.map((item) => (
          <SeminarCard
            key={item.seminar.id}
            item={item}
            now={now}
            variant="compact"
            titleAs="h3"
            registering={pendingId === item.seminar.id}
            locked={pendingId !== null}
            onRegister={onRegister}
          />
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby="upcoming-heading" className="flex flex-col gap-space-md">
      <div className="flex flex-col">
        <h2 id="upcoming-heading" className="font-headline-md text-headline-md text-on-surface">
          Upcoming Seminars
        </h2>
        <p className="font-body-sm text-body-sm text-text-secondary">Sorted by nearest seminar schedule</p>
      </div>
      {content}
    </section>
  );
}