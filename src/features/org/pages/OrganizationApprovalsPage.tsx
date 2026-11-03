import { useMemo, useState } from 'react';
import type { OrgRequest, OrgRequestStatus } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { orgActionTonal as actionTonal } from '../orgActionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';

type RequestFilter = 'all' | OrgRequestStatus;
const FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const REJECTION_REASONS = ['Position quota filled for current academic year', 'Incomplete documentation', 'Prerequisite requirements are not met', 'Other (custom note)'];

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
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [note, setNote] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const online = useOnlineStatus();
  const requests = state.status === 'success' ? state.data : [];
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const reviewRequest = reviewingId === 'none' ? null : requests.find((request) => request.id === reviewingId) ?? (reviewingId === null ? requests.find((request) => request.status === 'pending') ?? null : null);
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
    if (!reviewRequest) return;
    const detail = note.trim();
    const decisionNote = detail ? `${reason}: ${detail}` : reason;
    const saved = await decide(reviewRequest, 'rejected', decisionNote);
    if (saved) { setReviewingId('none'); setNote(''); setReason(REJECTION_REASONS[0]); }
  }

  return (
    <PageContainer width="full">
      <header className="flex flex-col justify-between gap-space-md rounded-xl border border-outline-variant/40 bg-surface-container-high p-space-md shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-space-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary"><Icon name="assignment_turned_in" size={24}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-space-sm"><h1 className="font-title-lg text-title-lg text-on-surface">{pendingCount} Pending Access {pendingCount === 1 ? 'Request' : 'Requests'}</h1><span className="rounded-full bg-primary-container px-2.5 py-1 font-label-sm text-label-sm text-on-primary">{pendingCount > 0 ? 'Requires adviser action' : 'Queue reviewed'}</span></div><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Review and verify student officer appointment requests for your organization.</p></div></div>
        <button type="button" onClick={reload} className={actionTonal}><Icon name="refresh" size={18} />Refresh</button>
      </header>

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}
      {!online && <aside role="status" className="flex items-start gap-space-md rounded-xl bg-surface-container-highest p-space-md shadow-sm"><Icon name="cloud_off" size={22} className="mt-0.5 shrink-0 text-secondary"/><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">System offline · cached mode active</p><p className="font-caption text-caption text-text-secondary">Showing saved requests. Approval and rejection are disabled until the connection returns.</p></div></aside>}

      <section aria-label="Search and filter access requests" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card md:flex-row md:items-center md:justify-between">
        <label className="relative block w-full md:max-w-sm"><span className="sr-only">Search access requests</span><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant, student ID, or role…" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-container-lowest pl-10 pr-3 font-body-sm text-body-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
        <div role="group" aria-label="Filter requests" className="flex gap-1 overflow-x-auto">{FILTERS.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 shrink-0 rounded-lg px-3 font-body-sm-medium text-body-sm-medium transition ${filter === item.value ? 'bg-primary-container text-on-primary' : 'text-text-secondary hover:bg-surface-container-high'}`}>{item.label}{item.value !== 'all' && <span className="ml-1.5 opacity-75">{requests.filter((request) => request.status === item.value).length}</span>}</button>)}</div>
      </section>

      {state.status === 'loading' && <LoadingRegion label="Loading access requests" className="flex flex-col gap-space-md">{[0,1].map((key) => <Skeleton key={key} className="h-64 rounded-xl" />)}</LoadingRegion>}
      {state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Unable to retrieve applications" action={<RetryButton onClick={reload} />}>Check your connection and try again.</StateMessage>}
      {state.status === 'empty' && <StateMessage icon="check_circle" title="No access requests yet">New student officer applications will appear here.</StateMessage>}
      {state.status === 'success' && visible.length === 0 && <StateMessage icon="search_off" title={requests.length === 0 ? 'No access requests yet' : 'No requests match your search'} action={requests.length > 0 ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className={actionTonal}>Clear filters</button> : undefined}>{requests.length === 0 ? 'New student officer applications will appear here.' : 'Try another name, student ID, or status filter.'}</StateMessage>}

      {state.status === 'success' && visible.length > 0 && <div className="grid items-start gap-space-lg xl:grid-cols-12"><section className="flex flex-col gap-space-md xl:col-span-7" aria-label="Officer access requests"><div className="flex items-center justify-between px-1"><span className="font-label-sm text-label-sm uppercase tracking-widest text-text-secondary">Applicant dossiers</span><span className="font-caption text-caption text-text-secondary">Sorted by submission time</span></div>{visible.map((request) => <article key={request.id} className="relative flex flex-col gap-space-md overflow-hidden rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg pl-space-xl shadow-card"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${request.status === 'pending' ? 'bg-primary' : request.status === 'approved' ? 'bg-status-available' : 'bg-text-subtle'}`} />
        <div className="flex flex-wrap items-start justify-between gap-space-sm"><div className="flex min-w-0 items-center gap-space-md"><ApplicantAvatar name={request.fullName} /><div className="min-w-0"><h2 className="truncate font-title-lg text-title-lg text-on-surface">{request.fullName}</h2><p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">{request.studentId}{request.position ? ` · ${request.position}` : ''}</p></div></div><StatusPill status={request.status} /></div>
        <div className="grid gap-space-sm rounded-lg bg-surface-container-low p-space-md sm:grid-cols-2"><div><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Requested role</p><p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-primary">{request.position}</p></div><div><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Organization</p><p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-on-surface">{request.organizationId === 'ccs-council' ? 'CCS Student Council' : request.organizationId}</p></div><div><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Student ID</p><p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-on-surface">{request.studentId}</p></div><div><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Appointment evidence</p><p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">Not included in the current request record</p></div>{request.statement && <div className="sm:col-span-2"><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Applicant statement</p><p className="mt-0.5 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">{request.statement}</p></div>}</div>
        <div className="flex flex-wrap items-center justify-between gap-space-sm font-caption text-caption text-text-secondary"><span className="inline-flex items-center gap-1.5"><Icon name="schedule" size={16} />Submitted {formatDate(request.requestedAt)}</span>{request.decidedAt && <span>Decision recorded {formatDate(request.decidedAt)}</span>}</div>
        {request.decisionNote && <p className="rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm text-text-secondary"><strong className="text-on-surface">Adviser feedback:</strong> {request.decisionNote}</p>}
        {request.status === 'pending' && <div className="flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/40 pt-space-md"><span className="font-caption text-caption text-text-secondary">Pending adviser decision</span><div className="flex gap-space-sm"><button type="button" disabled={!online || workingId !== null} onClick={() => { setReviewingId(request.id); setReason(REJECTION_REASONS[0]); setNote(''); setFailure(''); }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-space-md font-body-sm-medium text-body-sm-medium text-on-surface hover:bg-surface-container-high disabled:opacity-60"><Icon name="close" size={18} />Reject</button><button type="button" disabled={!online || workingId !== null} onClick={() => void decide(request, 'approved')} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-space-md font-body-sm-medium text-body-sm-medium text-on-primary shadow-card hover:bg-primary disabled:opacity-60"><Icon name="check_circle" size={18} />{workingId === request.id ? 'Saving…' : 'Approve access'}</button></div></div>}
      </article>)}</section><aside className="flex flex-col gap-space-lg xl:col-span-5"><div className="flex items-center justify-between px-1"><span className="font-label-sm text-label-sm uppercase tracking-widest text-text-secondary">Review workspace</span><span className="font-label-sm text-label-sm text-text-secondary">Current request queue</span></div><section className="flex w-full flex-col gap-space-md rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg shadow-card"><div className="flex items-start justify-between gap-space-sm"><div className="flex items-center gap-space-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-surface text-danger-ink"><Icon name="group_off" size={20}/></span><div><h2 className="font-title-lg text-title-lg text-on-surface">Reject access request</h2><p className="font-caption text-caption text-text-secondary">Formal decision notice</p></div></div>{reviewRequest&&<StatusPill status={reviewRequest.status}/>}</div>
{reviewRequest ? <><p className="font-body-sm text-body-sm leading-relaxed text-text-secondary">Select a reason for rejecting <strong className="text-on-surface">{reviewRequest.fullName}</strong>’s application. The note will be visible on their request status page.</p><div className="rounded-xl bg-surface-container-low p-space-md"><p className="font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Candidate</p><p className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{reviewRequest.studentId} · {reviewRequest.position}</p><p className="font-caption text-caption text-text-secondary">{reviewRequest.organizationId === 'ccs-council' ? 'CCS Student Council' : reviewRequest.organizationId}</p></div>
<fieldset className="flex flex-col gap-space-xs"><legend className="mb-1 font-label-sm text-label-sm font-semibold text-text-secondary">Standard review reason</legend>{REJECTION_REASONS.map((option,index)=><label key={option} className={`flex cursor-pointer items-start gap-space-sm rounded-lg p-space-sm transition-colors ${reason===option?'bg-surface-container-high ring-1 ring-primary/15':'bg-surface-container-low hover:bg-surface-container-high'}`}><input type="radio" name="rejection-reason" value={option} checked={reason===option} onChange={()=>setReason(option)} className="mt-1 accent-primary"/><span className="font-body-sm text-body-sm text-on-surface">{option}{index===0&&<span className="block font-caption text-caption text-text-secondary">Position capacity is already filled for this term.</span>}{index===1&&<span className="block font-caption text-caption text-text-secondary">Required supporting documents were not available for review.</span>}{index===2&&<span className="block font-caption text-caption text-text-secondary">Eligibility requirements need further verification.</span>}{index===3&&<span className="block font-caption text-caption text-text-secondary">Add a specific reason in the adviser feedback below.</span>}</span></label>)}</fieldset>
<label className="flex flex-col gap-space-xs font-label-sm text-label-sm font-semibold text-text-secondary" htmlFor="request-feedback">Adviser feedback note <span className="font-caption font-normal text-text-secondary">Optional note shown to the applicant</span><textarea id="request-feedback" rows={3} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Provide constructive guidance or explain next steps…" className="resize-y rounded-xl border border-outline-variant/55 bg-surface-container-low p-space-md font-body-sm text-body-sm font-normal text-on-surface outline-none placeholder:text-text-subtle focus:border-primary"/></label>
<div className="flex flex-col-reverse gap-space-sm border-t border-outline-variant/45 pt-space-md sm:flex-row sm:justify-end"><button type="button" disabled={workingId!==null} onClick={()=>setReviewingId('none')} className={actionTonal}>Keep request pending</button><button type="button" disabled={!online || workingId!==null} onClick={()=>void confirmRejection()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-space-md font-body-sm-medium text-body-sm-medium text-on-error disabled:opacity-60"><Icon name="close" size={18}/>{workingId===reviewRequest.id?'Saving…':'Confirm rejection'}</button></div></> : <StateMessage icon="check_circle" title="No request selected">Select Reject on a pending applicant dossier to prepare a decision notice.</StateMessage>}
</section><section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-high p-space-lg"><div className="flex items-center gap-space-sm text-primary"><Icon name="verified_user" size={20}/><h2 className="font-title-lg text-title-lg">Access decision policy</h2></div><p className="font-body-sm text-body-sm text-text-secondary">Approved applicants receive the organization access associated with the requested role. Rejection reasons and optional feedback are recorded for the applicant’s request status page.</p><div className="grid grid-cols-2 gap-space-sm"><div className="rounded-lg bg-surface-card p-space-md"><p className="font-caption text-caption text-text-secondary">Pending review</p><p className="mt-1 font-headline-sm text-headline-sm text-primary">{pendingCount}</p></div><div className="rounded-lg bg-surface-card p-space-md"><p className="font-caption text-caption text-text-secondary">Decision history</p><p className="mt-1 font-headline-sm text-headline-sm text-on-surface">{requests.length-pendingCount}</p></div></div></section></aside></div>}


    </PageContainer>
  );
}
