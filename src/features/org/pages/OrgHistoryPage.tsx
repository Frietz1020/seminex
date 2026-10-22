import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OrgSeminar } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getOrgLifecycle } from '../seminarStatus';

type ArchiveFilter = 'all' | 'finished' | 'cancelled';
const FILTERS: Array<{ value: ArchiveFilter; label: string }> = [
  { value: 'all', label: 'All archives' }, { value: 'finished', label: 'Finished' }, { value: 'cancelled', label: 'Cancelled' },
];
const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date));

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

function ArchiveCard({ seminar }: { seminar: OrgSeminar }) {
  const cancelled = Boolean(seminar.cancellation);
  const attendance = seminar.registeredCount;
  return (
    <article className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-space-sm"><span className="font-caption text-caption text-text-subtle">{formatDate(seminar.startsAt)}</span><span className="rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption text-text-secondary">{cancelled ? 'Cancelled' : 'Finished'}</span><span className="font-caption text-caption text-text-subtle">Ledger · {seminar.reference}</span></div>
          <h2 className="mt-space-sm font-title-lg text-title-lg text-on-surface">{seminar.title}</h2>
          <p className="mt-1 font-body-sm text-body-sm text-text-secondary">{seminar.speaker.name} · {seminar.venue}</p>
        </div>
        <Link to={`/org/my-seminars/${seminar.id}`} className={actionTonal}><Icon name="visibility" size={18} />View archive</Link>
      </div>
      {cancelled ? (
        <div className="rounded-lg bg-error-container p-space-md font-body-sm text-body-sm text-text-secondary"><strong>Cancellation notice</strong><p className="mt-1">{seminar.cancellation?.reason}</p><p className="mt-1">Cancelled {formatDate(seminar.cancellation?.at ?? seminar.startsAt)}.</p></div>
      ) : (
        <div className="grid gap-space-sm rounded-lg bg-surface-container-low p-space-md sm:grid-cols-3"><div><p className="font-caption text-caption text-text-secondary">Attendance records</p><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{attendance} registered</p></div><div><p className="font-caption text-caption text-text-secondary">Certificates</p><p className="font-body-sm-medium text-body-sm-medium text-on-surface">Eligibility in archive</p></div><div><p className="font-caption text-caption text-text-secondary">Record access</p><p className="font-body-sm-medium text-body-sm-medium text-on-surface">Read only</p></div></div>
      )}
    </article>
  );
}

export default function OrgHistoryPage() {
  const now = useNow();
  const { state, reload } = useResource(() => api.listOrgSeminars(), 'org-history');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  useEffect(() => { document.title = 'Organization history - Seminex'; }, []);

  const all = state.status === 'success' ? state.data.seminars.filter((item) => ['finished', 'cancelled'].includes(getOrgLifecycle(item, now))) : [];
  const visible = useMemo(() => all.filter((item) => {
    const cancelled = Boolean(item.cancellation);
    const statusMatch = filter === 'all' || (filter === 'cancelled' ? cancelled : !cancelled);
    const queryMatch = `${item.title} ${item.reference} ${item.speaker.name} ${item.venue}`.toLowerCase().includes(query.trim().toLowerCase());
    return statusMatch && queryMatch;
  }), [all, filter, query]);
  const finished = all.filter((item) => !item.cancellation).length;
  const cancelled = all.length - finished;

  return (
    <PageContainer>
      <header className="flex flex-col gap-space-xs">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Organization / History</p>
        <div className="flex flex-wrap items-end justify-between gap-space-md"><div><h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Seminar History &amp; Archives</h1><p className="mt-space-xs font-body-base text-body-base text-text-secondary">Review concluded seminars and access their saved organization records.</p></div>
          <button type="button" onClick={() => exportCsv(visible)} disabled={!visible.length} className={actionTonal}><Icon name="download" size={18} />Export summary</button>
        </div>
      </header>

      <aside className="flex items-start gap-space-md rounded-xl border border-border-subtle bg-surface-container-low p-space-lg"><Icon name="lock" size={20} className="mt-0.5 shrink-0 text-primary" /><div><h2 className="font-body-base-medium text-body-base-medium text-on-surface">Archived record integrity</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Concluded seminar records are read only. Attendance entries and cancellation notes remain available for review.</p></div></aside>

      <section aria-label="Archive metrics" className="grid grid-cols-2 gap-space-md sm:grid-cols-3"><div className="rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card"><p className="font-caption text-caption text-text-secondary">Concluded seminars</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{finished}</p></div><div className="rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card"><p className="font-caption text-caption text-text-secondary">Cancelled seminars</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{cancelled}</p></div><div className="col-span-2 rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card sm:col-span-1"><p className="font-caption text-caption text-text-secondary">Archive access</p><p className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">Verified from your organization records</p></div></section>

      <div className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card md:flex-row md:items-center md:justify-between">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="relative w-full md:max-w-md"><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" /><input type="search" aria-label="Search archived seminars" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search archived seminars by title or speaker…" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-light pl-10 pr-3 font-body-sm text-body-sm outline-none focus:border-primary" /></form>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter archived seminars">{FILTERS.map((item) => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 rounded-lg px-3 font-body-sm-medium text-body-sm-medium ${filter === item.value ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface-container-low'}`}>{item.label}</button>)}</div>
      </div>

      {state.status === 'loading' && <LoadingRegion label="Loading seminar archive" className="flex flex-col gap-space-md">{[0,1,2].map((key) => <Skeleton key={key} className="h-48 w-full rounded-xl" />)}</LoadingRegion>}
      {state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Failed to retrieve archive registry" action={<RetryButton onClick={reload} />}>The organization seminar records could not be loaded.</StateMessage>}
      {state.status === 'empty' && <StateMessage icon="folder_off" title="No archived seminars found">Concluded seminars will appear here after their scheduled end.</StateMessage>}
      {state.status === 'success' && (visible.length ? <div className="flex flex-col gap-space-md">{visible.map((seminar) => <ArchiveCard key={seminar.id} seminar={seminar} />)}</div> : <StateMessage icon="folder_off" title="No archived seminars found">No seminars match this year or filter. Adjust the search or status filter.</StateMessage>)}
    </PageContainer>
  );
}
