import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type OrgSeminar, type SeminarDraft } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getDraftReadiness } from '../readiness';
import { getOrgLifecycle, isOrgRecentlyFinished } from '../seminarStatus';

type View = 'all' | 'ongoing' | 'upcoming' | 'drafts' | 'recent';
type Sort = 'nearest' | 'az' | 'registrants';
const FILTERS: Array<{ value: View; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'recent', label: 'Finished recently' },
];

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function matchesQuery(seminar: OrgSeminar, query: string) {
  return `${seminar.title} ${seminar.speaker.name} ${seminar.venue} ${seminar.reference} ${seminar.department}`.toLowerCase().includes(query.trim().toLowerCase());
}

function SeminarCard({ seminar, now, ongoing = false }: { seminar: OrgSeminar; now: number; ongoing?: boolean }) {
  const status = seminar.cancellation ? 'Cancelled' : getOrgLifecycle(seminar, now);
  const percent = seminar.capacity ? Math.min(100, Math.round(seminar.registeredCount / seminar.capacity * 100)) : 0;
  return (
    <article className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-card transition hover:shadow-overlay ${ongoing ? 'lg:flex-row' : ''}`}>
      <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-surface-container-low via-surface-container to-primary-fixed/60 ${ongoing ? 'h-40 lg:h-auto lg:min-h-60 lg:w-5/12' : 'h-40'}`}>
        {seminar.imageUrl ? <img src={seminar.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="school" size={32} className="text-primary/70" />}
        <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 font-label-sm text-label-sm capitalize shadow-card ${status === 'ongoing' ? 'bg-secondary text-on-secondary' : 'bg-surface-card/95 text-primary'}`}>{status}</span>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-space-md p-space-lg">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">{seminar.department}</span><span className="font-caption text-caption text-text-subtle">{seminar.reference}</span></div>
          <h3 className="mt-1 font-title-lg text-title-lg text-on-surface group-hover:text-primary">{seminar.title}</h3>
          <div className="mt-space-sm flex flex-col gap-1.5 font-body-sm text-body-sm text-text-secondary">
            <p className="flex items-start gap-2"><Icon name="schedule" size={16} className="mt-0.5 shrink-0" />{dateTime(seminar.startsAt)}</p>
            <p className="flex items-start gap-2"><Icon name="location_on" size={16} className="mt-0.5 shrink-0" />{seminar.venue}</p>
            <p className="flex items-start gap-2"><Icon name="record_voice_over" size={16} className="mt-0.5 shrink-0" />{seminar.speaker.name}</p>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 font-caption text-caption"><span className="text-text-secondary">Slots reserved</span><span className="font-semibold text-on-surface">{seminar.registeredCount} / {seminar.capacity} ({percent}%)</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary-container" style={{ width: `${percent}%` }} /></div>
        </div>
        <div className="flex gap-space-sm">
          <Link to={`/org/my-seminars/${seminar.id}`} className={`${ongoing ? actionPrimary : actionTonal} flex-1 justify-center`}>{ongoing ? 'Open live console' : 'Open seminar'}<Icon name="arrow_forward" size={16} /></Link>
          {ongoing && <Link to={`/org/my-seminars/${seminar.id}/scanner`} aria-label={`Open scanner for ${seminar.title}`} className={actionTonal}><Icon name="qr_code_scanner" size={18} /></Link>}
        </div>
      </div>
    </article>
  );
}

function DraftCard({ draft }: { draft: SeminarDraft }) {
  const readiness = getDraftReadiness(draft);
  return (
    <article className="flex flex-col justify-between gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card sm:flex-row sm:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-space-sm"><span className="rounded-md bg-surface-container-high px-2.5 py-1 font-label-sm text-label-sm text-text-secondary">Draft</span><span className="font-caption text-caption text-text-secondary">{readiness.items.filter((item) => item.passed).length} of {readiness.items.length} setup steps complete</span></div><h3 className="mt-space-sm font-title-lg text-title-lg text-on-surface">{draft.details.title || 'Untitled seminar'}</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{readiness.firstBlockingReason || 'Review your seminar details before publishing.'}</p>{draft.details.startsAt && <p className="mt-1 font-caption text-caption text-text-subtle">Proposed date: {dateTime(draft.details.startsAt)}</p>}</div>
      <Link to={`/org/seminars/${draft.id}/edit`} className={`${actionTonal} shrink-0`}>Continue editing<Icon name="edit" size={16} /></Link>
    </article>
  );
}

export default function OrgSeminarsPage() {
  const now = useNow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('nearest');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const query = params.get('q') ?? '';
  const listing = useResource(() => api.listOrgSeminars(), 'org-seminars');
  const items = listing.state.status === 'success' ? listing.state.data.seminars : [];
  const drafts = listing.state.status === 'success' ? listing.state.data.drafts : [];
  const searched = useMemo(() => items.filter((item) => matchesQuery(item, query)), [items, query]);
  const ongoing = searched.filter((item) => getOrgLifecycle(item, now) === 'ongoing').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = searched.filter((item) => getOrgLifecycle(item, now) === 'upcoming').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const recentlyFinished = searched.filter((item) => isOrgRecentlyFinished(item, now)).sort((a, b) => b.endsAt.localeCompare(a.endsAt));
  const cancelled = searched.filter((item) => getOrgLifecycle(item, now) === 'cancelled');
  const visibleDrafts = drafts.filter((draft) => `${draft.details.title ?? ''} ${draft.details.venue ?? ''} ${draft.details.speakerName ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const total = ongoing.length + upcoming.length + recentlyFinished.length + cancelled.length + visibleDrafts.length;

  const orderedUpcoming = useMemo(() => {
    const sorted = [...upcoming];
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'registrants') sorted.sort((a, b) => b.registeredCount - a.registeredCount);
    return sorted;
  }, [upcoming, sort]);

  async function createDraft() {
    if (creating) return;
    setCreating(true);
    setCreateError(false);
    const result = await api.createOrgDraft();
    setCreating(false);
    if (!result.ok) { setCreateError(true); return; }
    navigate(`/org/seminars/${result.data.id}/edit`);
  }

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-md md:flex-row md:items-center">
        <div className="max-w-3xl"><p className="flex flex-wrap items-center gap-2 font-label-sm text-label-sm uppercase tracking-widest text-text-secondary"><span>Curriculum &amp; Events</span><span>/</span><span className="text-secondary">{listing.state.status === 'success' ? 'College of Computer Studies' : 'Organization'}</span></p><h1 className="mt-1 font-headline-xl text-headline-xl-mobile tracking-tight text-on-surface md:text-headline-xl">My Seminars</h1><p className="mt-1 font-body-base text-body-base text-text-secondary">Manage and monitor your organization seminars.</p></div>
        <button type="button" onClick={() => void createDraft()} disabled={creating} className={actionPrimary}><Icon name="add" size={20} />{creating ? 'Creating draft…' : 'Create seminar'}</button>
      </header>

      {createError && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md text-danger-ink">Could not create a seminar draft. Please try again.</p>}

      <section aria-label="Seminar search and filters" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative min-w-0 flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input aria-label="Search seminars by title, speaker, or venue" type="search" value={query} onChange={(event) => { const value = event.target.value; setParams((previous) => { const next = new URLSearchParams(previous); value ? next.set('q', value) : next.delete('q'); return next; }, { replace: true }); }} placeholder="Search seminar title, speaker, or venue…" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-container-low pl-10 pr-3 font-body-sm text-body-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </form>
          <div className="flex flex-wrap items-center gap-space-sm">
            <label htmlFor="seminar-sort" className="sr-only">Sort seminars</label><select id="seminar-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-11 rounded-lg border border-border-subtle bg-surface-container-low px-3 font-body-sm-medium text-body-sm-medium text-on-surface outline-none focus:border-primary"><option value="nearest">Nearest date</option><option value="az">Title (A–Z)</option><option value="registrants">Most registrants</option></select>
            <span className="rounded-lg bg-surface-container-low px-3 py-2 font-label-sm text-label-sm text-text-secondary">{total} total</span>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1" role="group" aria-label="Filter seminars">
          {FILTERS.map((item) => {
            const count = item.value === 'all' ? total : item.value === 'ongoing' ? ongoing.length : item.value === 'upcoming' ? upcoming.length : item.value === 'drafts' ? visibleDrafts.length : recentlyFinished.length;
            return <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 shrink-0 rounded-lg px-space-md font-body-sm-medium text-body-sm-medium transition ${filter === item.value ? 'bg-primary-container text-on-primary' : 'text-text-secondary hover:bg-surface-container-high'}`}>{item.label} ({count})</button>;
          })}
        </div>
      </section>

      {listing.state.status === 'loading' && <LoadingRegion label="Loading organization seminars" className="flex flex-col gap-space-xl"><Skeleton className="h-36 rounded-xl" /><div className="grid gap-space-md md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((key) => <Skeleton key={key} className="h-80 rounded-xl" />)}</div></LoadingRegion>}
      {listing.state.status === 'error' && <StateMessage role="alert" icon="info" title="Seminars could not be loaded" action={<RetryButton onClick={listing.reload} />}>Check your connection and try again.</StateMessage>}
      {listing.state.status === 'empty' && <StateMessage icon="event_note" title="No seminars or drafts yet" action={<button type="button" onClick={() => void createDraft()} className={actionPrimary}><Icon name="add" size={18} />Create a seminar</button>}>Start a seminar draft to add its details, certificate, and evaluation.</StateMessage>}

      {listing.state.status === 'success' && <div className="flex flex-col gap-space-xl">
        {(filter === 'all' || filter === 'ongoing') && <section className="flex flex-col gap-space-md" aria-labelledby="ongoing-heading"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-space-sm"><span className="h-3 w-3 animate-pulse rounded-full bg-secondary" /><h2 id="ongoing-heading" className="font-title-lg text-title-lg text-on-surface">Ongoing today</h2><span className="rounded-full bg-secondary-fixed px-2.5 py-1 font-caption text-caption text-on-secondary-fixed">{ongoing.length} active</span></div><span className="font-caption text-caption text-text-secondary">Live check-in available</span></div>{ongoing.length ? <div className="grid gap-space-md">{ongoing.map((seminar) => <SeminarCard key={seminar.id} seminar={seminar} now={now} ongoing />)}</div> : <StateMessage icon="event_busy" title="No seminars are ongoing right now">Upcoming sessions will appear below.</StateMessage>}</section>}

        {(filter === 'all' || filter === 'upcoming') && <section className="flex flex-col gap-space-md" aria-labelledby="upcoming-heading"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-space-sm"><h2 id="upcoming-heading" className="font-title-lg text-title-lg text-on-surface">Upcoming seminars</h2><span className="rounded-full bg-surface-container-high px-2.5 py-1 font-caption text-caption text-text-secondary">{upcoming.length} scheduled</span></div></div>{orderedUpcoming.length ? <div className="grid gap-space-md md:grid-cols-2 xl:grid-cols-3">{orderedUpcoming.map((seminar) => <SeminarCard key={seminar.id} seminar={seminar} now={now} />)}</div> : <StateMessage icon="event_busy" title="No upcoming seminars">Create a draft when you are ready to plan your next session.</StateMessage>}</section>}

        {(filter === 'all' || filter === 'drafts') && <section className="flex flex-col gap-space-md" aria-labelledby="drafts-heading"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-space-sm"><h2 id="drafts-heading" className="font-title-lg text-title-lg text-on-surface">Drafts</h2><span className="rounded-full bg-surface-container-high px-2.5 py-1 font-caption text-caption text-text-secondary">{visibleDrafts.length} in preparation</span></div><span className="font-caption text-caption text-text-secondary">Not published to the participant catalog</span></div>{visibleDrafts.length ? <div className="grid gap-space-md">{visibleDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)}</div> : <StateMessage icon="draft" title="No drafts match your search">Create a seminar to begin a new draft.</StateMessage>}</section>}

        {(filter === 'all' || filter === 'recent') && <section className="flex flex-col gap-space-md" aria-labelledby="recent-heading"><div className="flex items-center gap-space-sm"><h2 id="recent-heading" className="font-title-lg text-title-lg text-on-surface">Finished recently</h2><span className="rounded-full bg-surface-container-high px-2.5 py-1 font-caption text-caption text-text-secondary">{recentlyFinished.length}</span></div>{recentlyFinished.length ? <div className="grid gap-space-md md:grid-cols-2 xl:grid-cols-3">{recentlyFinished.map((seminar) => <SeminarCard key={seminar.id} seminar={seminar} now={now} />)}</div> : <StateMessage icon="history" title="No recently finished seminars">Completed seminars are available in History.</StateMessage>}</section>}

        {filter === 'all' && cancelled.length > 0 && <section className="flex flex-col gap-space-md" aria-labelledby="cancelled-heading"><h2 id="cancelled-heading" className="font-title-lg text-title-lg text-on-surface">Cancelled seminars</h2><div className="grid gap-space-md md:grid-cols-2 xl:grid-cols-3">{cancelled.map((seminar) => <SeminarCard key={seminar.id} seminar={seminar} now={now} />)}</div></section>}
      </div>}
    </PageContainer>
  );
}
