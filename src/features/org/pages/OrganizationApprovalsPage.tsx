import { useMemo, useState } from 'react';
import type { OrgRequest, OrgRequestStatus } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionTonal } from '../../../components/ui/actionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';

type RequestFilter = 'all' | OrgRequestStatus;
const FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const REJECTION_REASONS = ['Position already filled', 'Appointment documents are incomplete', 'Prerequisite requirements are not met', 'Other'];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ApplicantAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-high font-title-md text-title-md font-semibold text-primary">{initials}</span>;
}

function StatusPill({ status }: { status: OrgRequestStatus }) {
  const style = status === 'pending' ? 'bg-secondary-fixed text-on-secondary-fixed' : status === 'approved' ? 'bg-status-available-container text-status-available' : 'bg-danger-surface text-danger-ink';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm capitalize ${style}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

export default function OrganizationApprovalsPage() {
  const { state, reload } = useResource(() => api.listAdviserOrgRequests(), 'adviser-org-requests', (items) => items.length === 0);
  const [filter, setFilter] = useState<RequestFilter>('pending');
  const [query, setQuery] = useState('');
  const [rejecting, setRejecting] = useState<OrgRequest | null>(null);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [note, setNote] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const requests = state.status === 'success' ? state.data : [];
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const visible = useMemo(() => requests.filter((request) => {
    const statusMatch = filter === 'all' || request.status === filter;
    const text = `${request.fullName} ${request.studentId} ${request.position} ${request.organizationId}`.toLowerCase();
    return statusMatch && text.includes(query.trim().toLowerCase());
  }), [requests, filter, query]);

  async function decide(request: OrgRequest, decision: 'approved' | 'rejected', decisionNote = '') {
    if (workingId) return;
    setWorkingId(request.id);
    setFailure('');
    const result = await api.decideAdviserOrgRequest(request.id, decision, decisionNote);
    setWorkingId(null);
    if (!result.ok) { setFailure('Could not save the decision. The request remains unchanged. Try again.'); return false; }
    reload();
    return true;
  }

  async function confirmRejection() {
    if (!rejecting) return;
    const detail = note.trim();
    const decisionNote = detail ? `${reason}: ${detail}` : reason;
    const saved = await decide(rejecting, 'rejected', decisionNote);
    if (saved) { setRejecting(null); setNote(''); setReason(REJECTION_REASONS[0]); }
  }

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
        <div><p className="flex items-center gap-2 font-label-sm text-label-sm uppercase tracking-widest text-primary"><Icon name="verified_user" size={18} />Faculty adviser</p><div className="mt-1 flex flex-wrap items-center gap-space-sm"><h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Access Requests</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 font-label-sm text-label-sm font-semibold text-on-secondary-fixed"><span className="h-1.5 w-1.5 rounded-full bg-secondary" />{pendingCount} pending</span></div><p className="mt-1 font-body-base text-body-base text-text-secondary">Review student officer appointments for the organizations you advise.</p></div>
        <button type="button" onClick={reload} className={actionTonal}><Icon name="refresh" size={18} />Refresh</button>
      </header>

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}
      {pendingCount > 0 && <aside className="flex items-start gap-space-md rounded-xl border border-secondary-fixed bg-gradient-to-r from-secondary-fixed/70 to-surface-container-low p-space-md shadow-card"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary"><Icon name="pending_actions" size={20} /></span><span><span className="block font-body-sm-medium text-body-sm-medium text-primary">{pendingCount} pending {pendingCount === 1 ? 'request requires' : 'requests require'} adviser action</span><span className="mt-0.5 block font-caption text-caption text-text-secondary">Approving grants organization workspace access to the applicant.</span></span></aside>}

      <section aria-label="Search and filter access requests" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card md:flex-row md:items-center md:justify-between">
        <label className="relative block w-full md:max-w-sm"><span className="sr-only">Search access requests</span><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant, student ID, or role…" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-container-lowest pl-10 pr-3 font-body-sm text-body-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
        <div role="group" aria-label="Filter requests" className="flex gap-1 overflow-x-auto">{FILTERS.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 shrink-0 rounded-lg px-3 font-body-sm-medium text-body-sm-medium transition ${filter === item.value ? 'bg-primary-container text-on-primary' : 'text-text-secondary hover:bg-surface-container-high'}`}>{item.label}{item.value !== 'all' && <span className="ml-1.5 opacity-75">{requests.filter((request) => request.status === item.value).length}</span>}</button>)}</div>
      </section>

      {state.status === 'loading' && <LoadingRegion label="Loading access requests" className="flex flex-col gap-space-md">{[0,1].map((key) => <Skeleton key={key} className="h-64 rounded-xl" />)}</LoadingRegion>}
      {state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Unable to retrieve applications" action={<RetryButton onClick={reload} />}>Check your connection and try again.</StateMessage>}
      {state.status === 'empty' && <StateMessage icon="check_circle" title="No access requests yet">New student officer applications will appear here.</StateMessage>}
      {state.status === 'success' && visible.length === 0 && <StateMessage icon="search_off" title={requests.length === 0 ? 'No access requests yet' : 'No requests match your search'} action={requests.length > 0 ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className={actionTonal}>Clear filters</button> : undefined}>{requests.length === 0 ? 'New student officer applications will appear here.' : 'Try another name, student ID, or status filter.'}</StateMessage>}

      {state.status === 'success' && visible.length > 0 && <section className="flex flex-col gap-space-md" aria-label="Officer access requests">{visible.map((request) => <article key={request.id} className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-space-sm"><div className="flex min-w-0 items-center gap-space-md"><ApplicantAvatar name={request.fullName} /><div className="min-w-0"><h2 className="truncate font-title-lg text-title-lg text-on-surface">{request.fullName}</h2><p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">{request.studentId}{request.position ? ` · ${request.position}` : ''}</p></div></div><StatusPill status={request.status} /></div>
        <div className="grid gap-space-sm rounded-lg bg-surface-container-low p-space-md sm:grid-cols-2"><div><p className="font-label-sm text-label-sm text-text-secondary">Organization</p><p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-on-surface">{request.organizationId === 'ccs-council' ? 'CCS Student Council' : request.organizationId}</p></div><div><p className="font-label-sm text-label-sm text-text-secondary">Requested position</p><p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-on-surface">{request.position}</p></div>{request.statement && <div className="sm:col-span-2"><p className="font-label-sm text-label-sm text-text-secondary">Applicant statement</p><p className="mt-0.5 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">{request.statement}</p></div>}</div>
        <div className="flex flex-wrap items-center justify-between gap-space-sm font-caption text-caption text-text-secondary"><span className="inline-flex items-center gap-1.5"><Icon name="schedule" size={16} />Submitted {formatDate(request.requestedAt)}</span>{request.decidedAt && <span>Decision recorded {formatDate(request.decidedAt)}</span>}</div>
        {request.decisionNote && <p className="rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm text-text-secondary"><strong className="text-on-surface">Adviser feedback:</strong> {request.decisionNote}</p>}
        {request.status === 'pending' && <div className="grid grid-cols-2 gap-space-sm pt-1 sm:justify-end"><button type="button" disabled={workingId !== null} onClick={() => { setRejecting(request); setReason(REJECTION_REASONS[0]); setNote(''); setFailure(''); }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-surface-container px-space-md font-body-sm-medium text-body-sm-medium text-on-surface hover:bg-surface-container-high disabled:opacity-60"><Icon name="close" size={18} />Reject</button><button type="button" disabled={workingId !== null} onClick={() => void decide(request, 'approved')} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-space-md font-body-sm-medium text-body-sm-medium text-on-primary shadow-card hover:bg-primary disabled:opacity-60"><Icon name="check_circle" size={18} />{workingId === request.id ? 'Saving…' : 'Approve access'}</button></div>}
      </article>)}</section>}

      <Dialog open={rejecting !== null} onClose={() => { if (!workingId) setRejecting(null); }} title="Reject access request">
        {rejecting && <div className="mt-space-md flex flex-col gap-space-md">{failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-sm font-body-sm text-body-sm text-danger-ink">{failure}</p>}<div className="flex min-w-0 items-center gap-space-sm rounded-xl bg-surface-container-low p-space-md"><ApplicantAvatar name={rejecting.fullName} /><span className="min-w-0"><span className="block truncate font-body-sm-medium text-body-sm-medium text-on-surface">{rejecting.fullName}</span><span className="block truncate font-caption text-caption text-text-secondary">Candidate for {rejecting.position}</span></span></div><fieldset className="flex flex-col gap-2"><legend className="font-label-sm text-label-sm font-semibold text-on-surface">Reason for rejection</legend>{REJECTION_REASONS.map((option) => <label key={option} className="flex min-h-10 items-center gap-2 rounded-lg px-2 font-body-sm text-body-sm text-text-secondary hover:bg-surface-container-low"><input type="radio" name="rejection-reason" value={option} checked={reason === option} onChange={() => setReason(option)} className="accent-primary" />{option}</label>)}</fieldset><label className="flex flex-col gap-1.5 font-label-sm text-label-sm font-semibold text-on-surface" htmlFor="request-feedback">Optional feedback note shown to the applicant<textarea id="request-feedback" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a constructive note or guidance for reapplying…" className="resize-y rounded-xl border border-border-subtle bg-surface-container-low p-space-md font-body-sm text-body-sm font-normal text-on-surface outline-none placeholder:text-text-subtle focus:border-primary" /></label><div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end"><button type="button" disabled={workingId !== null} onClick={() => setRejecting(null)} className={actionTonal}>Keep request pending</button><button type="button" disabled={workingId !== null} onClick={() => void confirmRejection()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 font-body-sm-medium text-body-sm-medium text-on-error disabled:opacity-60"><Icon name="close" size={18} />{workingId === rejecting.id ? 'Saving…' : 'Confirm rejection'}</button></div></div>}
      </Dialog>
    </PageContainer>
  );
}
