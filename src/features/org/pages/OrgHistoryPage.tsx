import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OrgSeminar } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useResource } from '../../../hooks/useResource';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { OrgStatusBadge } from '../components/OrgStatusBadge';
import { getEffectiveEnd, getOrgLifecycle } from '../seminarStatus';

type ArchiveFilter = 'all' | 'finished' | 'cancelled';
const FILTERS: Array<{ value: ArchiveFilter; label: string }> = [
  { value: 'all', label: 'All archives' }, { value: 'finished', label: 'Finished' }, { value: 'cancelled', label: 'Cancelled' },
];
const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date));
const formatDateTime = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

function academicYear(value: string) {
  const date = new Date(value);
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}–${start + 1}`;
}

function exportCsv(items: OrgSeminar[]) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['Reference', 'Seminar', 'Status', 'Date', 'Venue', 'Speaker', 'Registered', 'Capacity'],
    ...items.map((item) => [item.reference, item.title, item.cancellation ? 'Cancelled' : 'Finished', item.startsAt, item.venue, item.speaker.name, item.registeredCount, item.capacity]),
  ];
  const blob = new Blob([rows.map((row) => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'seminex-organization-history.csv'; anchor.click(); URL.revokeObjectURL(url);
}

function ArchiveAttendanceMetrics({ seminar }: { seminar: OrgSeminar }) {
  const ledger = useResource(() => api.listLedger(seminar.id), `org-history-ledger-${seminar.id}`, (items) => items.length === 0);
  const entries = ledger.state.status === 'success' ? ledger.state.data : [];
  const ledgerAvailable = ledger.state.status === 'success' || ledger.state.status === 'empty';
  const timeIn = new Set(entries.filter((entry) => entry.kind === 'time_in').map((entry) => entry.studentId)).size;
  const timeOut = new Set(entries.filter((entry) => entry.kind === 'time_out').map((entry) => entry.studentId)).size;
  const metrics = [
    { label: 'Registered', value: String(seminar.registeredCount), detail: `of ${seminar.capacity} seats` },
    { label: 'Students timed in', value: ledgerAvailable ? String(timeIn) : ledger.state.status === 'loading' ? '…' : '—', detail: ledger.state.status === 'error' ? 'Unavailable' : ledger.state.status === 'empty' ? 'No scan records' : 'With a recorded check-in' },
    { label: 'Students timed out', value: ledgerAvailable ? String(timeOut) : ledger.state.status === 'loading' ? '…' : '—', detail: ledger.state.status === 'error' ? 'Unavailable' : ledger.state.status === 'empty' ? 'No scan records' : 'With a recorded check-out' },
  ];
  return <div className="grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm sm:gap-space-md sm:p-space-md xl:min-w-[390px]">{metrics.map((metric) => <div key={metric.label} className="min-w-0"><p className="truncate font-caption text-caption uppercase tracking-wide text-text-secondary">{metric.label}</p><p className="mt-0.5 font-headline-sm text-headline-sm text-on-surface">{metric.value}</p><p className="truncate font-caption text-caption text-text-secondary">{metric.detail}</p></div>)}</div>;
}

function DateTile({ date, cancelled }: { date: string; cancelled: boolean }) {
  const parsed = new Date(date);
  return <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl ${cancelled ? 'bg-danger-surface text-danger-ink' : 'bg-surface-container-low text-on-surface'}`}>
    <span className={`font-label-sm text-label-sm uppercase ${cancelled ? 'text-danger' : 'text-primary'}`}>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(parsed)}</span>
    <span className="font-headline-md text-headline-md leading-none">{new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(parsed)}</span>
    <span className="font-caption text-caption">{parsed.getFullYear()}</span>
  </div>;
}

function ArchiveCard({ seminar, now, onCancellation }: { seminar: OrgSeminar; now: number; onCancellation: (seminar: OrgSeminar) => void }) {
  const cancelled = Boolean(seminar.cancellation);
  const ended = new Date(getEffectiveEnd(seminar)).toISOString();
  return <article className="flex flex-col gap-space-lg rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg shadow-card transition-shadow hover:shadow-overlay xl:flex-row xl:items-center xl:justify-between">
    <div className="flex min-w-0 flex-1 items-start gap-space-md">
      <DateTile date={seminar.startsAt} cancelled={cancelled} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-space-xs"><OrgStatusBadge status={getOrgLifecycle(seminar, now)} /><span aria-hidden="true" className="text-text-subtle">·</span><span className="font-caption text-caption text-text-secondary">{cancelled ? `Cancelled ${formatDate(seminar.cancellation?.at ?? seminar.startsAt)}` : `Concluded ${formatDateTime(ended)}`}</span><span aria-hidden="true" className="text-text-subtle">·</span><span className="font-caption text-caption text-text-secondary">Record #{seminar.reference}</span></div>
        <h2 className="truncate font-title-lg text-title-lg text-on-surface">{seminar.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-body-sm text-text-secondary"><span className="inline-flex items-center gap-1.5"><Icon name="person" size={16} className="text-primary" />{seminar.speaker.name}</span>{!cancelled && <span className="inline-flex items-center gap-1.5"><Icon name="location_on" size={16} />{seminar.venue}</span>}<span className="inline-flex items-center gap-1.5"><Icon name="school" size={16} />{seminar.department}</span></div>
        {cancelled && <p className="mt-2 line-clamp-2 font-caption text-caption text-danger-ink">{seminar.cancellation?.reason}</p>}
      </div>
    </div>
    {cancelled ? <div className="flex flex-col gap-space-sm xl:w-[390px] xl:shrink-0"><div className="grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low/70 p-space-md opacity-75"><div><p className="font-caption text-caption uppercase text-text-secondary">Attendance</p><p className="mt-1 font-body-sm-medium text-body-sm-medium text-text-secondary">N/A</p><p className="font-caption text-caption text-text-secondary">Cancelled</p></div><div><p className="font-caption text-caption uppercase text-text-secondary">Registered</p><p className="mt-1 font-body-sm-medium text-body-sm-medium text-text-secondary">{seminar.registeredCount}</p><p className="font-caption text-caption text-text-secondary">Registrations</p></div><div><p className="font-caption text-caption uppercase text-text-secondary">Record</p><p className="mt-1 font-body-sm-medium text-body-sm-medium text-text-secondary">Read only</p><p className="font-caption text-caption text-text-secondary">Archived</p></div></div><div className="flex flex-wrap gap-space-sm"><button type="button" onClick={() => onCancellation(seminar)} className={`${actionPrimary} flex-1 justify-center`}><Icon name="info" size={16} />View cancellation notice</button><Link to={`/org/my-seminars/${seminar.id}`} className={`${actionTonal} justify-center`}><Icon name="visibility" size={18} />Open</Link></div></div> : <div className="flex flex-col gap-space-sm xl:flex-row xl:items-center"><ArchiveAttendanceMetrics seminar={seminar} /><Link to={`/org/my-seminars/${seminar.id}`} className={`${actionPrimary} justify-center`}><Icon name="visibility" size={18} />Open read-only</Link></div>}
  </article>;
}

export default function OrgHistoryPage() {
  const now = useNow();
  const online = useOnlineStatus();
  const { state, reload } = useResource(() => api.listOrgSeminars({ seminars: { pageSize: 999 }, drafts: { pageSize: 1 } }), 'org-history');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const [year, setYear] = useState('all');
  const [cancellationNotice, setCancellationNotice] = useState<OrgSeminar | null>(null);
  useEffect(() => { document.title = 'Organization history - Seminex'; }, []);

  const all = state.status === 'success' && now !== null ? state.data.seminars.items.filter((item) => ['finished', 'cancelled'].includes(getOrgLifecycle(item, now))) : [];
  const years = [...new Set(all.map((item) => academicYear(item.startsAt)))].sort((a, b) => b.localeCompare(a));
  const visible = useMemo(() => all.filter((item) => {
    const isCancelled = Boolean(item.cancellation);
    const statusMatch = filter === 'all' || (filter === 'cancelled' ? isCancelled : !isCancelled);
    const yearMatch = year === 'all' || academicYear(item.startsAt) === year;
    const queryMatch = `${item.title} ${item.reference} ${item.speaker.name} ${item.venue} ${item.department}`.toLowerCase().includes(query.trim().toLowerCase());
    return statusMatch && yearMatch && queryMatch;
  }), [all, filter, query, year]);
  const finished = all.filter((item) => !item.cancellation);
  const cancelled = all.filter((item) => item.cancellation);
  const archivedRegistrations = finished.reduce((total, item) => total + item.registeredCount, 0);
  const archivedCapacity = finished.reduce((total, item) => total + item.capacity, 0);

  const summary = [
    { label: 'Finished seminars', value: finished.length, icon: 'event_available' },
    { label: 'Cancelled seminars', value: cancelled.length, icon: 'event_busy' },
    { label: 'Registrations archived', value: archivedRegistrations, icon: 'group' },
    { label: 'Seats in finished seminars', value: archivedCapacity, icon: 'confirmation_number' },
  ] as const;

  if (now === null) {
    return <PageContainer><p role="status" className="font-body-sm text-body-sm text-text-secondary">Loading current seminar times…</p></PageContainer>;
  }

  return <PageContainer>
    {!online && <aside role="status" className="flex items-start gap-space-sm rounded-xl border border-outline-variant/50 bg-surface-container-highest p-space-md"><Icon name="cloud_off" size={20} className="mt-0.5 shrink-0 text-secondary" /><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">Offline archive view</p><p className="font-caption text-caption text-text-secondary">Showing saved organization records from this device. Reconnect to refresh the archive.</p></div></aside>}
    <header className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap items-end justify-between gap-space-md"><div><h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Seminar History &amp; Archives</h1></div>
        <button type="button" onClick={() => exportCsv(visible)} disabled={!visible.length} className={actionTonal}><Icon name="download" size={18} />Export archive CSV</button>
      </div>
    </header>

    <aside className="flex items-start gap-space-md rounded-xl border border-outline-variant/45 bg-surface-container-low p-space-lg shadow-sm"><Icon name="lock" size={20} className="mt-0.5 shrink-0 text-primary" /><div><h2 className="font-body-base-medium text-body-base-medium text-on-surface">Read-only archive</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Concluded seminar records remain available for review. Attendance entries and cancellation notices are preserved with their recorded details.</p></div></aside>

    <section aria-label="Archive summary" className="grid grid-cols-2 gap-space-md sm:grid-cols-4">{summary.map((item) => <article key={item.label} className="flex min-h-32 flex-col justify-between rounded-xl border border-outline-variant/45 bg-surface-card p-space-md shadow-card"><div className="flex items-start justify-between gap-2"><p className="font-caption text-caption uppercase tracking-wide text-text-secondary">{item.label}</p><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary"><Icon name={item.icon} size={18} /></span></div><p className="font-headline-md text-headline-md text-on-surface">{item.value}</p></article>)}</section>

    <section aria-label="Archive filters" className="flex flex-col gap-space-md rounded-xl border border-outline-variant/45 bg-surface-card p-space-md shadow-card lg:flex-row lg:items-center lg:justify-between">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative w-full lg:max-w-md"><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" /><input type="search" aria-label="Search archived seminars" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, speaker, reference, or venue…" className="h-12 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest pl-10 pr-3 font-body-sm text-body-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></form>
      <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center"><label htmlFor="archive-year" className="sr-only">Academic year</label><select id="archive-year" value={year} onChange={(event) => setYear(event.target.value)} className="h-12 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-sm-medium text-body-sm-medium text-on-surface outline-none focus:border-primary"><option value="all">All academic years</option>{years.map((item) => <option key={item} value={item}>Academic Year {item}</option>)}</select><div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-high p-1.5" role="group" aria-label="Filter archived seminars">{FILTERS.map((item) => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-11 shrink-0 rounded-xl px-3 font-body-sm-medium text-body-sm-medium ${filter === item.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-text-secondary hover:bg-surface-container-highest'}`}>{item.label}</button>)}</div></div>
    </section>

    {state.status === 'loading' && <LoadingRegion label="Loading seminar archive" className="flex flex-col gap-space-md">{[0,1,2].map((key) => <Skeleton key={key} className="h-48 w-full rounded-xl" />)}</LoadingRegion>}
    {state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Failed to retrieve archive registry" action={<RetryButton onClick={reload} />}>The organization seminar records could not be loaded.</StateMessage>}
    {state.status === 'empty' && <StateMessage icon="folder_off" title="No archived seminars found">Concluded seminars will appear here after their scheduled end.</StateMessage>}
    {state.status === 'success' && (visible.length ? <><p className="font-body-sm text-body-sm text-text-secondary">Showing {visible.length} of {all.length} archived seminars</p><div className="flex flex-col gap-space-md">{visible.map((seminar) => <ArchiveCard key={seminar.id} seminar={seminar} now={now} onCancellation={setCancellationNotice} />)}</div></> : <StateMessage icon="folder_off" title="No archived seminars found">No seminars match the selected year, search, or status. Adjust the filters to see more records.</StateMessage>)}

    <Dialog open={Boolean(cancellationNotice)} onClose={() => setCancellationNotice(null)} title="Cancellation official notice">
      {cancellationNotice?.cancellation && <div className="mt-space-md flex flex-col gap-space-md"><div className="rounded-xl bg-danger-surface p-space-md"><p className="font-label-sm text-label-sm uppercase tracking-wide text-danger">Cancelled seminar</p><h3 className="mt-1 font-title-lg text-title-lg text-on-surface">{cancellationNotice.title}</h3><p className="mt-1 font-caption text-caption text-text-secondary">Record {cancellationNotice.reference}</p></div><dl className="grid gap-space-md sm:grid-cols-2"><div><dt className="font-caption text-caption text-text-secondary">Cancelled on</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{formatDateTime(cancellationNotice.cancellation.at)}</dd></div><div><dt className="font-caption text-caption text-text-secondary">Recorded by</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{cancellationNotice.cancellation.officerName}</dd></div><div className="sm:col-span-2"><dt className="font-caption text-caption text-text-secondary">Official reason</dt><dd className="mt-1 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">{cancellationNotice.cancellation.reason}</dd></div></dl><div className="flex justify-end"><button type="button" onClick={() => setCancellationNotice(null)} className={actionPrimary}>Close notice</button></div></div>}
    </Dialog>
  </PageContainer>;
}
