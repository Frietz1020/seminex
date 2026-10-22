import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Seminar } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { AcademicYearPill } from '../../../components/ui/AcademicYearPill';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { SegmentedControl, type SegmentOption } from '../../../components/ui/SegmentedControl';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useToast } from '../../../components/ui/Toast';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getAcademicPeriod } from '../academicPeriod';
import { formatDayLabel, formatTimeRange } from '../format';
import { QrCode } from '../QrCode';
import { getLifecycle } from '../status';
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
  const period = getAcademicPeriod(now);
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

  const registeredItems =
    seminars.state.status === 'success'
      ? seminars.state.data.filter((item) => item.registration && !cancelledIds.includes(item.seminar.id))
      : [];
  const metricView = seminars.state.status === 'success'
    ? buildMySeminarView(registeredItems, { query: '', filter: 'all', sort: 'nearest' }, now)
    : null;
  const activeTicketItem = [...registeredItems]
    .filter((item) => getLifecycle(item.seminar, now) !== 'finished')
    .sort((a, b) => {
      const aOngoing = getLifecycle(a.seminar, now) === 'ongoing' ? 0 : 1;
      const bOngoing = getLifecycle(b.seminar, now) === 'ongoing' ? 0 : 1;
      return aOngoing - bOngoing || Math.abs(Date.parse(a.seminar.startsAt) - now) - Math.abs(Date.parse(b.seminar.startsAt) - now);
    })[0] ?? null;
  const featuredTicket = useResource<import('../../../api/types').Ticket | null>(
    () => activeTicketItem
      ? api.getTicket(activeTicketItem.seminar.id)
      : Promise.resolve({ ok: true as const, data: null }),
    `my-seminars-featured-ticket-${activeTicketItem?.seminar.id ?? 'none'}`,
    (ticket) => ticket === null,
  );

  const groupCount = (group: MySeminarFilter | 'evaluation') =>
    metricView?.groups.find((entry) => entry.group === group)?.items.length ?? 0;

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
          icon="event_busy"
          title={searching ? 'No matching seminars found' : 'No seminars in this view'}
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

  // Search and filters appear only when there are active seminars.
  const showControls = view !== null && view.activeCount > 0;

  return (
    <PageContainer>
      <header className="flex flex-col gap-space-xs">
        <div className="flex flex-wrap items-center gap-space-sm">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Student portal</p>
          <AcademicYearPill academicYear={period.academicYear} />
        </div>
        <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">
          My seminars
        </h1>
        <p className="font-body-base text-body-base text-text-secondary">
          View your registered seminars, manage your seats, and access your attendance details.
        </p>
      </header>

      {view && (
        <dl className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
          <div className="flex items-center justify-between gap-space-sm rounded-xl border border-border-subtle bg-surface-card px-space-md py-space-sm shadow-card">
            <dt className="font-body-sm text-body-sm text-text-secondary">Registered seminars</dt>
            <dd className="font-headline-sm text-headline-sm text-primary">{view.registeredCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-space-sm rounded-xl border border-border-subtle bg-surface-card px-space-md py-space-sm shadow-card">
            <dt className="font-body-sm text-body-sm text-text-secondary">Upcoming</dt>
            <dd className="font-headline-sm text-headline-sm text-on-surface">{groupCount('upcoming')}</dd>
          </div>
          <div className="flex items-center justify-between gap-space-sm rounded-xl border border-border-subtle bg-surface-card px-space-md py-space-sm shadow-card">
            <dt className="font-body-sm text-body-sm text-text-secondary">Evaluation due</dt>
            <dd className="font-headline-sm text-headline-sm text-secondary">{groupCount('evaluation')}</dd>
          </div>
        </dl>
      )}

      {showControls && (
        <div className="flex flex-col items-stretch justify-between gap-space-md rounded-xl bg-surface-card p-space-md shadow-card md:flex-row md:items-center">
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative flex-1 md:max-w-md">
            <label htmlFor="my-seminars-search" className="sr-only">
              Search your seminars by title, speaker, topic, department, or venue
            </label>
            <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              ref={searchRef}
              id="my-seminars-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, speaker, topic, department, or venue"
              className={`${CONTROL} pl-10 pr-11 placeholder:text-text-subtle`}
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle transition-colors hover:text-on-surface">
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

      {activeTicketItem && activeTicketItem.registration ? (
        <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-space-xl lg:col-span-8">{renderBody()}</div>

          <aside className="flex flex-col gap-space-md lg:sticky lg:top-24 lg:col-span-4">
            <section aria-labelledby="active-ticket-heading" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-space-sm">
                <div>
                  <h2 id="active-ticket-heading" className="font-title-md text-title-md text-on-surface">Active ticket</h2>
                  <p className="mt-1 font-caption text-caption text-text-secondary">
                    {getLifecycle(activeTicketItem.seminar, now) === 'ongoing' ? 'Session in progress' : 'Ready for your next session'}
                  </p>
                </div>
                <Icon name="confirmation_number" size={22} className="text-primary" />
              </div>

              {featuredTicket.state.status === 'success' && featuredTicket.state.data ? (
                <div className="mx-auto rounded-xl border border-border-subtle bg-white p-space-sm shadow-card">
                  <QrCode
                    value={featuredTicket.state.data.token}
                    size={176}
                    label={`QR ticket for ${activeTicketItem.seminar.title}`}
                  />
                </div>
              ) : featuredTicket.state.status === 'loading' ? (
                <Skeleton className="mx-auto h-48 w-48 rounded-xl" />
              ) : featuredTicket.state.status === 'error' ? (
                <div role="alert" className="rounded-lg border border-border-subtle bg-surface-container-low p-space-md">
                  <p className="font-body-sm text-body-sm text-text-secondary">
                    The ticket preview could not be loaded. {errorText(featuredTicket.state.code)}
                  </p>
                  <RetryButton onClick={featuredTicket.reload} />
                </div>
              ) : null}

              <div className="min-w-0 text-center">
                <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">{activeTicketItem.seminar.title}</h3>
                <p className="mt-1 font-caption text-caption text-text-secondary">
                  {formatDayLabel(activeTicketItem.seminar.startsAt, now)} · {formatTimeRange(activeTicketItem.seminar.startsAt, activeTicketItem.seminar.endsAt)}
                </p>
                <p className="mt-1 truncate font-caption text-caption text-text-secondary">{activeTicketItem.seminar.venue}</p>
                <p className="mt-2 font-mono text-caption text-text-subtle">Seat reference: {activeTicketItem.registration.reference}</p>
              </div>

              <Link to={`/my-seminars/${activeTicketItem.seminar.id}?tab=ticket`} className={`${actionPrimary} w-full`}>
                <Icon name="qr_code_2" size={18} />
                <span>Open attendance ticket</span>
              </Link>
              <p className="text-center font-caption text-caption text-text-secondary">
                Show your QR ticket to a marshal for entry and exit scans.
              </p>
            </section>

            <section aria-labelledby="attendance-directives-heading" className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
              <div className="flex items-center gap-2">
                <Icon name="fact_check" size={20} className="text-primary" />
                <h2 id="attendance-directives-heading" className="font-title-md text-title-md text-on-surface">Attendance directives</h2>
              </div>
              <ul className="flex flex-col gap-space-sm font-body-sm text-body-sm text-text-secondary">
                <li className="flex items-start gap-2"><Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-status-available" /><span>Keep your QR ticket ready for the marshal at the venue.</span></li>
                <li className="flex items-start gap-2"><Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-status-available" /><span>Both Time-In and Time-Out scans are used to validate attendance.</span></li>
                <li className="flex items-start gap-2"><Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-status-available" /><span>Meet the seminar’s minimum attendance and submit its evaluation to qualify for a certificate.</span></li>
              </ul>
              <Link to="/guidelines" className="mt-1 inline-flex min-h-10 items-center gap-1 font-body-sm-medium text-body-sm-medium text-primary hover:underline">
                Registration guidelines <Icon name="arrow_forward" size={16} />
              </Link>
            </section>

            <section aria-labelledby="seminar-progress-heading" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h2 id="seminar-progress-heading" className="font-title-md text-title-md text-on-surface">Seminar progress</h2>
                <Icon name="school" size={20} className="text-text-subtle" />
              </div>
              <div className="grid grid-cols-3 gap-space-sm text-center">
                <div className="rounded-lg border border-border-subtle bg-surface-container-low p-space-sm">
                  <p className="font-headline-md text-headline-md text-primary">{registeredItems.length}</p>
                  <p className="font-caption text-caption text-text-secondary">Registered</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-container-low p-space-sm">
                  <p className="font-headline-md text-headline-md text-status-available">{registeredItems.filter((item) => item.registration?.timeOut?.validated).length}</p>
                  <p className="font-caption text-caption text-text-secondary">Attendance verified</p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-container-low p-space-sm">
                  <p className="font-headline-md text-headline-md text-secondary">{registeredItems.filter((item) => item.registration?.certificateIssuedAt).length}</p>
                  <p className="font-caption text-caption text-text-secondary">Certificates</p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-2 font-caption text-caption text-text-secondary">
                  <span>Verified attendance</span>
                  <span>{registeredItems.filter((item) => item.registration?.timeOut?.validated).length} of {registeredItems.length}</span>
                </div>
                <ProgressBar
                  value={registeredItems.filter((item) => item.registration?.timeOut?.validated).length}
                  max={registeredItems.length}
                  label="Verified attendance across registered seminars"
                  tone="available"
                />
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-space-xl">{renderBody()}</div>
      )}

      <CancelRegistrationDialog seminar={cancelling} onClose={() => setCancelling(null)} onCancelled={handleCancelled} />
    </PageContainer>
  );
}
