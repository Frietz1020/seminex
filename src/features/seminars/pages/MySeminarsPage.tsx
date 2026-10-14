import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Seminar } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { SegmentedControl, type SegmentOption } from '../../../components/ui/SegmentedControl';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useToast } from '../../../components/ui/Toast';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import {
  buildMySeminarView,
  type MySeminarFilter,
  type MySeminarSort,
} from '../../../lib/seminarStatus';
import { CancelRegistrationDialog } from '../components/CancelRegistrationDialog';
import { SeminarGroup } from '../components/SeminarGroup';

const FILTERS: readonly SegmentOption<MySeminarFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'upcoming', label: 'Upcoming' },
];

const CONTROL =
  'h-11 w-full rounded-lg border border-charcoal-300 bg-surface-light font-body-sm text-body-sm text-on-surface outline-none transition-all focus:border-primary-container focus:bg-surface-card focus:ring-2 focus:ring-primary-container/30';

export default function MySeminarsPage() {
  const now = useNow();
  const { showToast } = useToast();
  const seminars = useResource(() => api.listSeminars(), 'my-seminars');
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MySeminarFilter>('all');
  const [sort, setSort] = useState<MySeminarSort>('nearest');
  const [cancelling, setCancelling] = useState<Seminar | null>(null);
  // Registrations cancelled on this page, hidden at once without reloading the list.
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'My seminars - Seminex';
  }, []);

  function handleCancelled(seminar: Seminar) {
    setCancelledIds((ids) => [...ids, seminar.id]);
    setCancelling(null);
    showToast({ title: 'Registration cancelled', message: seminar.title });
  }

  // The list as the student sees it: cancelled registrations are already removed.
  const view =
    seminars.state.status === 'success'
      ? buildMySeminarView(
          seminars.state.data.filter((item) => !cancelledIds.includes(item.seminar.id)),
          { query, filter, sort },
          now,
        )
      : null;

  function renderBody() {
    if (seminars.state.status === 'loading') {
      return (
        <LoadingRegion label="Loading your seminars" className="flex flex-col gap-space-md">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-52 w-full rounded-xl" />
          ))}
        </LoadingRegion>
      );
    }

    if (seminars.state.status === 'error') {
      return (
        <StateMessage
          role="alert"
          icon="info"
          title="Your seminars could not be loaded"
          action={<RetryButton onClick={seminars.reload} />}
        >
          {errorText(seminars.state.code)}
        </StateMessage>
      );
    }

    if (seminars.state.status !== 'success' || !view) return null;

    if (view.registeredCount === 0) {
      return (
        <StateMessage
          icon="event_busy"
          title="You have not registered for any seminar yet"
          action={
            <Link to="/seminars" className={actionPrimary}>
              <Icon name="explore" size={18} />
              <span>Browse available seminars</span>
            </Link>
          }
        >
          Find a seminar you want to attend, then register to get your QR ticket.
        </StateMessage>
      );
    }

    if (view.activeCount === 0) {
      return (
        <StateMessage
          icon="history"
          title="No seminars to attend or answer right now"
          action={
            <Link to="/history" className={actionPrimary}>
              <span>View history</span>
            </Link>
          }
        >
          Seminars you registered for that are finished are in History.
        </StateMessage>
      );
    }

    if (view.groups.length === 0) {
      const searching = query.trim() !== '';
      return (
        <StateMessage
          icon="search_off"
          title="No matching seminars found"
          action={
            <button
              type="button"
              onClick={() => {
                if (searching) {
                  setQuery('');
                  searchRef.current?.focus();
                } else {
                  setFilter('all');
                }
              }}
              className={actionPrimary}
            >
              {searching ? 'Clear search' : 'Show all seminars'}
            </button>
          }
        >
          {searching
            ? 'No registered seminar matches your search. Try a different title, speaker, or topic.'
            : 'You have no seminars in this group. Show all seminars to see the rest.'}
        </StateMessage>
      );
    }

    const shown = view.groups.reduce((total, entry) => total + entry.items.length, 0);
    return (
      <>
        {seminars.state.fromCache && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary"
          >
            <Icon name="info" size={18} />
            No connection. Showing your saved seminars.
          </p>
        )}
        <p role="status" className="sr-only">
          {shown} {shown === 1 ? 'seminar' : 'seminars'} shown
        </p>
        {view.groups.map(({ group, items: groupItems }) => (
          <SeminarGroup key={group} group={group} items={groupItems} now={now} onCancel={setCancelling} />
        ))}
      </>
    );
  }

  // Search and filters appear only when there is something to search.
  const showControls = view !== null && view.activeCount > 0;

  return (
    <PageContainer width="narrow">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">My seminars</h1>

      {showControls && (
        <div className="flex flex-col items-stretch justify-between gap-space-md rounded-xl bg-surface-card p-space-md shadow-card md:flex-row md:items-center">
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative flex-1 md:max-w-md">
            <label htmlFor="my-seminars-search" className="sr-only">
              Search your seminars by title, speaker, or topic
            </label>
            <Icon
              name="search"
              size={20}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <input
              ref={searchRef}
              id="my-seminars-search"
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, speaker, or topic"
              className={`${CONTROL} pl-10 pr-11 placeholder:text-text-subtle`}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle transition-colors hover:text-on-surface"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-space-sm">
            <SegmentedControl legend="Show seminars" name="my-seminars-filter" options={FILTERS} value={filter} onChange={setFilter} />
            <div className="relative min-w-52 flex-1 md:flex-none">
              <label htmlFor="my-seminars-sort" className="sr-only">
                Sort seminars
              </label>
              <select
                id="my-seminars-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as MySeminarSort)}
                className={`${CONTROL} cursor-pointer appearance-none pl-3 pr-9 font-body-sm-medium text-body-sm-medium`}
              >
                <option value="nearest">Sort by: Nearest date</option>
                <option value="title">Sort by: A to Z</option>
              </select>
              <Icon
                name="keyboard_arrow_down"
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-space-xl">{renderBody()}</div>

      <CancelRegistrationDialog seminar={cancelling} onClose={() => setCancelling(null)} onCancelled={handleCancelled} />
    </PageContainer>
  );
}