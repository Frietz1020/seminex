import { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { api } from '../../../api/client';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PageContainer } from '../../../components/shell/PageContainer';
import { useResource } from '../../../hooks/useResource';

export default function OrganizationApprovalsPage() {
  const { state, reload } = useResource(() => api.listAdviserOrgRequests(), 'adviser-org-requests', (items) => items.length === 0);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);

  useEffect(() => { document.title = 'Organization approvals - Seminex'; }, []);

  async function decide(requestId: string, decision: 'approved' | 'rejected') {
    setWorkingId(requestId);
    setFailure(false);
    const result = await api.decideAdviserOrgRequest(requestId, decision);
    setWorkingId(null);
    if (!result.ok) {
      setFailure(true);
      return;
    }
    reload();
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-maroon"><ShieldCheck className="h-4 w-4" />Faculty adviser</div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Organization access requests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal-700">Review officer appointments for your organization. Approved officers can sign in to the organization workspace.</p>
        </div>
        <button type="button" onClick={reload} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-charcoal-300 bg-white px-4 text-sm font-semibold text-charcoal-800 hover:border-maroon hover:text-maroon"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      {failure && <div className="mt-5"><Alert variant="error" icon={X} title="Could not save the decision">Please try again. The request remains unchanged.</Alert></div>}

      <section className="mt-7 space-y-4" aria-label="Officer requests">
        {state.status === 'loading' && <div role="status" className="rounded-xl bg-white p-6 text-sm text-charcoal-600">Loading requests…</div>}
        {state.status === 'error' && <div className="rounded-xl border border-danger-soft bg-danger-surface p-5 text-sm text-danger-ink" role="alert">Could not load adviser requests. <button type="button" onClick={reload} className="font-semibold underline">Try again</button></div>}
        {state.status === 'empty' && <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center"><BadgeCheck className="mx-auto h-8 w-8 text-success" /><h2 className="mt-3 font-heading text-lg font-bold text-charcoal-900">No requests to review</h2><p className="mt-1 text-sm text-charcoal-600">New officer access requests will appear here.</p></div>}
        {state.status === 'success' && state.data.map((request) => (
          <article key={request.id} className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-control sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-heading text-lg font-bold text-charcoal-900">{request.fullName}</h2><p className="mt-1 text-sm text-charcoal-700">Student ID: <strong>{request.studentId}</strong></p></div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${request.status === 'pending' ? 'bg-amber-50 text-amber-900' : request.status === 'approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
                {request.status === 'pending' ? <Clock3 className="h-3.5 w-3.5" /> : request.status === 'approved' ? <BadgeCheck className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{request.status}
              </span>
            </div>
            <div className="mt-4 grid gap-2 rounded-lg bg-cream-50 p-4 text-sm sm:grid-cols-2"><p><span className="text-charcoal-600">Organization</span><strong className="ml-2 text-charcoal-900">{request.organizationId}</strong></p><p><span className="text-charcoal-600">Requested role</span><strong className="ml-2 text-charcoal-900">{request.position}</strong></p></div>
            {request.status === 'pending' && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={workingId !== null} loading={workingId === request.id} loadingLabel="Saving…" icon={<X className="h-4 w-4" />} className="sm:w-auto" onClick={() => void decide(request.id, 'rejected')}>Reject request</Button><Button disabled={workingId !== null} loading={workingId === request.id} loadingLabel="Saving…" icon={<BadgeCheck className="h-4 w-4" />} className="sm:w-auto" onClick={() => void decide(request.id, 'approved')}>Approve officer</Button></div>}
            {request.decisionNote && <p className="mt-3 text-sm text-charcoal-700">Decision note: {request.decisionNote}</p>}
          </article>
        ))}
      </section>
      <p className="mt-6 text-xs text-charcoal-500">Request decisions are stored in this browser in the current mock environment.</p>
    </PageContainer>
  );
}
