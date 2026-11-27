import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { PageHeader } from '../../../components/shell/PageHeader';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { filterAndSort, getDepartments, getMetrics, getOpenItems, type SortKey } from '../catalog';
import { SeminarCard } from '../components/SeminarCard';
import { SeminarToolbar } from '../components/SeminarToolbar';
import { useRegistration } from '../useRegistration';
import type { SeminarListItem } from '../../../api/types';

function isUnregistered(item: SeminarListItem): boolean {
  return !item.registration || item.registration.status === 'cancelled' || item.registration.status === 'released';
}

export default function AvailableSeminarsPage() {
  const now = useNow();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('nearest');
  const [department, setDepartment] = useState<string | null>(null);
  const [additionalPages, setAdditionalPages] = useState<Array<{ items: SeminarListItem[]; nextCursor: string | null }>>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  useEffect(() => {
    document.title = 'Available seminars - Seminex';
  }, []);

  const seminars = useResource(
    () => api.listAvailableSeminars({ pageSize: 50 }),
    'available-seminars',
    (page) => now !== null && getOpenItems(page.items, now).filter(isUnregistered).length === 0 && page.nextCursor === null,
  );
  const baseItems = useMemo(
    () =>
      seminars.state.status === 'success'
        ? [...seminars.state.data.items, ...additionalPages.flatMap((page) => page.items)]
        : null,
    [seminars.state, additionalPages],
  );
  const nextCursor = additionalPages.length > 0
    ? additionalPages[additionalPages.length - 1]?.nextCursor ?? null
    : seminars.state.status === 'success' ? seminars.state.data.nextCursor : null;
  const registration = useRegistration(baseItems);

  const openItems = useMemo(
    () => (registration.items && now !== null ? getOpenItems(registration.items, now).filter(isUnregistered) : []),
    [registration.items, now],
  );
  const departments = useMemo(() => getDepartments(openItems), [openItems]);
  const activeDepartment = department && departments.includes(department) ? department : null;
  const visible = useMemo(
    () => filterAndSort(openItems, { query, department: activeDepartment, sort }),
    [openItems, query, activeDepartment, sort],
  );
  const metrics = getMetrics(openItems);
  const offline = seminars.state.status === 'success' && seminars.state.fromCache;

  if (now === null) {
    return <PageContainer><p role="status" className="font-body-sm text-body-sm text-text-secondary">Loading current seminar times…</p></PageContainer>;
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const result = await api.listAvailableSeminars({ cursor: nextCursor, pageSize: 50 });
    if (result.ok) setAdditionalPages((pages) => [...pages, result.data]);
    else setLoadMoreError(true);
    setLoadingMore(false);
  }

  function reloadSeminars() {
    setAdditionalPages([]);
    setLoadMoreError(false);
    seminars.reload();
  }

  let content;
  if (seminars.state.status === 'loading') {
    content = (
      <LoadingRegion label="Loading available seminars">
        <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-[28rem] rounded-xl" />
          ))}
        </div>
      </LoadingRegion>
    );
  } else if (seminars.state.status === 'error') {
    content = (
      <StateMessage
        role="alert"
        icon="info"
        title="Seminars could not be loaded"
        action={<RetryButton onClick={reloadSeminars} />}
      >
        {errorText(seminars.state.code)}
      </StateMessage>
    );
  } else if (seminars.state.status === 'empty' || openItems.length === 0) {
    content = (
      <StateMessage
        icon="event_available"
        title="No seminars are open right now"
        action={
          <div className="flex flex-wrap justify-center gap-space-sm">
            <Link to="/my-seminars" className={actionPrimary}>
              View my seminars
            </Link>
          </div>
        }
      >
        Seminars you register for move to My seminars. New sessions appear here as soon as they are scheduled.
      </StateMessage>
    );
  } else if (visible.length === 0) {
    content = (
      <StateMessage
        icon="event_busy"
        title={query.trim() ? 'No seminars match your search' : 'No seminars in this department'}
        action={
          <div className="flex flex-wrap justify-center gap-space-sm">
            {query.trim() && (
              <button type="button" onClick={() => setQuery('')} className={actionPrimary}>
                Clear search
              </button>
            )}
            {activeDepartment && (
              <button type="button" onClick={() => setDepartment(null)} className={actionPrimary}>
                Show all departments
              </button>
            )}
          </div>
        }
      >
        {query.trim()
          ? 'Try different keywords, or clear the search to see more seminars.'
          : 'Clear the department filter to see every open seminar.'}
      </StateMessage>
    );
  } else {
    content = (
      <div className="flex flex-col gap-space-md">
        {offline && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary"
          >
            <Icon name="info" size={18} />
            You are offline. Showing only the seminars you registered for.
          </p>
        )}
        <div className="grid grid-cols-1 items-start gap-space-lg md:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <SeminarCard
              key={item.seminar.id}
              item={item}
              now={now}
              variant="detailed"
              titleAs="h2"
              registering={registration.pendingId === item.seminar.id}
              locked={registration.pendingId !== null}
              onRegister={registration.register}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Available seminars"
        subtitle="Discover open CCS seminars and reserve your seat."
        meta={
          seminars.state.status === 'loading' ? (
            <Skeleton className="h-7 w-32 rounded-full" />
          ) : seminars.state.status === 'error' ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-maroon-container px-3 py-1 font-label-sm text-label-sm tabular-nums text-primary">
              <Icon name="event_available" size={14} />
              {metrics.sessions} {metrics.sessions === 1 ? 'active session' : 'active sessions'}
            </span>
          )
        }
      />

      {seminars.state.status === 'success' && openItems.length > 0 && (
        <SeminarToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          departments={departments}
          department={activeDepartment}
          onDepartmentChange={setDepartment}
        />
      )}

      {seminars.state.status === 'success' && (
        <p role="status" className="sr-only">
          {visible.length} {visible.length === 1 ? 'seminar' : 'seminars'} shown
        </p>
      )}

      {content}
      {loadMoreError && <p role="alert" className="rounded-lg bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">More seminars could not be loaded. Please try again.</p>}
      {nextCursor && (
        <div className="flex flex-col items-center gap-space-sm">
          <p className="sr-only" role="status" aria-live="polite">{loadingMore ? 'Loading more seminars' : `${visible.length} seminars currently shown`}</p>
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-space-lg font-body-sm-medium text-body-sm-medium text-primary transition-shadow hover:shadow-card disabled:opacity-60">
            {loadingMore ? 'Loading…' : 'Load more seminars'}
          </button>
        </div>
      )}
    </PageContainer>
  );
}
