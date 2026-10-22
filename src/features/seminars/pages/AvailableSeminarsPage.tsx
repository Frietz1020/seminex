import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { AcademicYearPill } from '../../../components/ui/AcademicYearPill';
import { getAcademicPeriod } from '../academicPeriod';
import { filterAndSort, getDepartments, getMetrics, getOpenItems, type SortKey } from '../catalog';
import { SeminarCard } from '../components/SeminarCard';
import { SeminarToolbar } from '../components/SeminarToolbar';
import { useRegistration } from '../useRegistration';

export default function AvailableSeminarsPage() {
  const now = useNow();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('nearest');
  const [department, setDepartment] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Available seminars - Seminex';
  }, []);

  const seminars = useResource(
    () => api.listSeminars(),
    'available-seminars',
    (items) => getOpenItems(items, Date.now()).length === 0,
  );
  const baseItems = seminars.state.status === 'success' ? seminars.state.data : null;
  const registration = useRegistration(baseItems);

  const openItems = useMemo(
    () => (registration.items ? getOpenItems(registration.items, now) : []),
    [registration.items, now],
  );
  const departments = useMemo(() => getDepartments(openItems), [openItems]);
  const activeDepartment = department && departments.includes(department) ? department : null;
  const visible = useMemo(
    () => filterAndSort(openItems, { query, department: activeDepartment, sort }),
    [openItems, query, activeDepartment, sort],
  );
  const metrics = getMetrics(openItems);
  const period = getAcademicPeriod(now);
  const offline = seminars.state.status === 'success' && seminars.state.fromCache;

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
        action={<RetryButton onClick={seminars.reload} />}
      >
        {errorText(seminars.state.code)}
      </StateMessage>
    );
  } else if (seminars.state.status === 'empty') {
    content = (
      <StateMessage
        icon="event_available"
        title="No seminars are open right now"
        action={
          <Link to="/home" className={actionPrimary}>
            Back to home
          </Link>
        }
      >
        New seminars appear here as soon as the council schedules them.
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
      <header className="flex flex-col justify-between gap-space-lg md:flex-row md:items-end">
        <div className="flex max-w-2xl flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <AcademicYearPill academicYear={period.academicYear} />
            <span className="font-caption text-caption text-text-subtle">{period.term} workshops</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">
            Available seminars
          </h1>
          <p className="font-body-base text-body-base text-text-secondary">
            Browse and register for upcoming CCS Student Council technical seminars and workshops.
          </p>
        </div>

        {seminars.state.status === 'loading' ? (
          <Skeleton className="h-20 w-64 self-start md:self-auto" />
        ) : seminars.state.status === 'error' ? null : (
          <dl className="flex items-center gap-space-md self-start rounded-xl bg-surface-card p-space-md shadow-card md:self-auto">
            <div className="flex flex-col pr-space-md">
              <dt className="font-caption text-caption font-semibold text-text-subtle">Active sessions</dt>
              <dd className="font-headline-sm text-headline-sm text-on-surface">
                {metrics.sessions} {metrics.sessions === 1 ? 'session' : 'sessions'}
              </dd>
            </div>
            <div aria-hidden="true" className="h-8 w-px bg-surface-container-high" />
            <div className="flex flex-col">
              <dt className="font-caption text-caption font-semibold text-text-subtle">Open seats</dt>
              <dd className="font-headline-sm text-headline-sm text-status-available">
                {metrics.openSeats} {metrics.openSeats === 1 ? 'seat' : 'seats'}
              </dd>
            </div>
          </dl>
        )}
      </header>

      <aside
        aria-labelledby="notice-heading"
        className="flex flex-col items-start justify-between gap-space-md rounded-xl bg-surface-container-low p-space-lg md:flex-row md:items-center"
      >
        <div className="flex items-start gap-space-md">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card text-primary shadow-card"
          >
            <Icon name="info" size={20} />
          </div>
          <div className="flex flex-col">
            <h2 id="notice-heading" className="font-body-base-medium text-body-base-medium text-on-surface">
              Attendance and certification notice
            </h2>
            <p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
              Registering reserves your seat. Your certificate is issued once your attendance is verified by QR
              scan at the venue entrance.
            </p>
          </div>
        </div>
        <Link
          to="/guidelines"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 font-body-sm-medium text-body-sm-medium text-primary transition-colors hover:text-maroon-dark"
        >
          <span>Registration guidelines</span>
          <Icon name="arrow_forward" size={16} />
        </Link>
      </aside>

      {seminars.state.status === 'success' && (
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
    </PageContainer>
  );
}
