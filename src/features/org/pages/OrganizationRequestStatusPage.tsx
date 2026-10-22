import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, BadgeCheck, Check, Clock3, Info, RefreshCw, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { api, type OrgAccessStatusResult } from '../../../api/client';
import { BrandMark } from '../../../components/shell/BrandMark';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { useSession } from '../../../session/useSession';

function dateLabel(value?: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const STATUS_DETAILS: Record<OrgAccessStatusResult['status'], { title: string; description: string; Icon: typeof Clock3; tone: string }> = {
  pending: { title: 'Officer Request Pending Adviser Review', description: 'Your request is in the review queue. Participant portal access remains available while the adviser reviews your appointment.', Icon: Clock3, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  approved: { title: 'Officer Access Approved', description: 'Your appointment is approved. You can now enter the organization workspace.', Icon: BadgeCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  rejected: { title: 'Officer Request Not Approved', description: 'Your request was reviewed. Read the adviser’s note below, then contact the adviser or submit a new request.', Icon: X, tone: 'border-rose-200 bg-rose-50 text-rose-900' },
  removed: { title: 'Organization Officer Access Concluded', description: 'Your organization appointment has ended or been removed. Standard participant access is still available.', Icon: Archive, tone: 'border-charcoal-200 bg-cream-100 text-charcoal-900' },
  none: { title: 'No Officer Request Found', description: 'You can request access to a recognized student organization when you are ready.', Icon: Info, tone: 'border-charcoal-200 bg-white text-charcoal-900' },
};

export default function OrganizationRequestStatusPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, reload } = useResource(() => api.getMyOrgAccessStatus(), `my-org-access-${session?.studentId ?? ''}`);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Organization request status - Seminex'; }, []);

  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;
  if (session?.role === 'org_member') return <Navigate to="/org" replace />;

  async function withdraw() {
    if (!window.confirm('Withdraw your pending organization access request?')) return;
    setWorking(true);
    setActionError(null);
    const result = await api.withdrawMyOrgRequest();
    setWorking(false);
    if (result.ok) reload();
    else setActionError(result.error.code === 'network' ? 'The request could not be withdrawn while offline. Try again.' : 'The request could not be withdrawn. Refresh the status and try again.');
  }

  const data: OrgAccessStatusResult = state.status === 'success'
    ? state.data
    : { status: 'none', request: null, organization: null, membership: null, adviser: null };
  const details = STATUS_DETAILS[data.status];
  const organization = data.organization?.name ?? 'CCS Student Council';
  const position = data.request?.position ?? data.membership?.position ?? 'Officer';
  const submitted = (location.state as { submitted?: unknown } | null)?.submitted === true;

  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="border-b border-charcoal-200 bg-white"><div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-5 sm:px-8"><Link to="/" className="flex items-center gap-3"><BrandMark size={36} /><span><strong className="block font-heading text-base text-charcoal-900">Seminex CCS</strong><small className="text-xs text-charcoal-600">Organization access center</small></span></Link><Link to="/home" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Participant portal</Link></div></header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-burnt">Office of Student Affairs · Registrar Gateway</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-charcoal-900">Chartered Organization Access</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal-700">Check adviser review, appointment details, and access to your organization workspace.</p></div>{data && <Button variant="secondary" disabled={state.status === 'loading'} loading={state.status === 'loading'} icon={<RefreshCw className="h-4 w-4" />} onClick={reload}>Refresh status</Button>}</div>

        {submitted && data.status === 'pending' && <div className="mb-5"><Alert variant="neutral" icon={Check} title="Officer request submitted">Your request is saved in this device’s Seminex mock records and is now pending adviser review.</Alert></div>}
        {actionError && <div className="mb-5"><Alert variant="error" icon={TriangleAlert} title="Action not completed">{actionError}</Alert></div>}

        {state.status === 'loading' && <LoadingRegion label="Loading organization request status"><Skeleton className="h-40 w-full" /><Skeleton className="mt-5 h-64 w-full" /></LoadingRegion>}
        {state.status === 'error' && <InlineError onRetry={reload}>The request status could not be loaded.</InlineError>}
        {state.status === 'success' && (
          <>
            <section className={`rounded-2xl border p-6 shadow-control sm:p-8 ${details.tone}`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/75"><details.Icon aria-hidden="true" className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-widest opacity-75">{data.status === 'none' ? 'Status' : `Request ${data.status}`}</p><h2 className="mt-1 font-heading text-xl font-bold sm:text-2xl">{details.title}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">{details.description}</p></div></div><span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">{data.request?.id ?? data.membership?.id ?? 'No reference yet'}</span></div>
              {data.status !== 'none' && <div className="mt-6 grid gap-4 border-t border-current/15 pt-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider opacity-70">Organization</p><p className="mt-1 font-semibold">{organization}</p></div><div><p className="text-xs uppercase tracking-wider opacity-70">Appointed role</p><p className="mt-1 font-semibold">{position}</p></div><div><p className="text-xs uppercase tracking-wider opacity-70">Submitted</p><p className="mt-1 font-medium">{dateLabel(data.request?.requestedAt)}</p></div><div><p className="text-xs uppercase tracking-wider opacity-70">Reviewer</p><p className="mt-1 font-medium">{data.adviser ? `${data.adviser.firstName} ${data.adviser.lastName} · Faculty Adviser` : 'CCS Faculty Adviser'}</p></div></div>}
            </section>

            {data.status !== 'none' && <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <section className="rounded-2xl border border-charcoal-200 bg-white p-6 shadow-control sm:p-7"><div className="flex items-center justify-between"><h3 className="font-heading text-lg font-bold text-charcoal-900">Review lifecycle</h3><span className="text-xs text-charcoal-500">{data.status === 'pending' ? 'Usually 1–2 work days' : 'Request record'}</span></div>
                <ol className="mt-6 space-y-0">
                  <li className="relative flex gap-4 pb-7"><span className="absolute left-3.5 top-8 h-full w-px bg-emerald-300" /><span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Check className="h-4 w-4" /></span><div><p className="font-semibold text-charcoal-900">Request submitted</p><p className="mt-1 text-sm text-charcoal-600">Appointment details were recorded in Seminex.</p><p className="mt-1 text-xs text-charcoal-500">{dateLabel(data.request?.requestedAt)}</p></div></li>
                  <li className={`relative flex gap-4 pb-7 ${data.status === 'pending' ? '' : ''}`}><span className={`absolute left-3.5 top-8 h-full w-px ${data.status === 'approved' || data.status === 'removed' ? 'bg-emerald-300' : 'bg-charcoal-200'}`} /><span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${data.status === 'pending' ? 'bg-amber-100 text-amber-800' : data.status === 'approved' || data.status === 'removed' ? 'bg-emerald-100 text-emerald-800' : data.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-charcoal-100 text-charcoal-500'}`}>{data.status === 'approved' || data.status === 'removed' ? <Check className="h-4 w-4" /> : data.status === 'rejected' ? <X className="h-4 w-4" /> : <span>2</span>}</span><div><p className="font-semibold text-charcoal-900">Faculty adviser review</p><p className="mt-1 text-sm text-charcoal-600">{data.status === 'pending' ? 'Your appointment is under review.' : data.status === 'approved' || data.status === 'removed' ? `Reviewed by ${data.adviser ? `${data.adviser.firstName} ${data.adviser.lastName}` : 'the faculty adviser'}.` : data.status === 'rejected' ? 'The adviser recorded a decision for this request.' : 'Waiting for adviser review.'}</p>{data.request?.decidedAt && <p className="mt-1 text-xs text-charcoal-500">{dateLabel(data.request.decidedAt)}</p>}{data.request?.decisionNote && <blockquote className="mt-3 rounded-lg bg-rose-50 p-3 text-sm italic text-rose-900">“{data.request.decisionNote}”</blockquote>}</div></li>
                  <li className="flex gap-4"><span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${data.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : data.status === 'removed' ? 'bg-charcoal-100 text-charcoal-600' : 'bg-charcoal-100 text-charcoal-500'}`}>{data.status === 'approved' ? <ShieldCheck className="h-4 w-4" /> : data.status === 'removed' ? <Archive className="h-4 w-4" /> : <span>3</span>}</span><div><p className="font-semibold text-charcoal-900">Workspace access</p><p className="mt-1 text-sm text-charcoal-600">{data.status === 'approved' ? 'Organization workspace access is enabled.' : data.status === 'removed' ? 'Officer permissions have ended; participant access remains.' : 'Workspace tools unlock after approval.'}</p></div></li>
                </ol>
              </section>
              <aside className="space-y-4"><section className="rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control"><h3 className="font-heading font-bold text-charcoal-900">Access summary</h3><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-charcoal-600">Current privileges</span><strong className="text-right text-charcoal-900">{data.status === 'approved' ? 'Organization officer' : 'Participant'}</strong></div><div className="flex justify-between gap-3"><span className="text-charcoal-600">Request status</span><strong className="capitalize text-charcoal-900">{data.status}</strong></div><div className="flex justify-between gap-3"><span className="text-charcoal-600">Academic cycle</span><strong className="text-right text-charcoal-900">Current cycle</strong></div></div></section><div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950"><p className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" />Notice for appointee</p><p className="mt-2">You can continue using the Participant Portal normally. Status updates appear here when the adviser’s decision is recorded.</p></div></aside>
            </div>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {data.status === 'pending' && <Button variant="secondary" disabled={working} loading={working} icon={<X className="h-4 w-4" />} onClick={withdraw}>Withdraw request</Button>}
              {data.status === 'approved' && <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/organization/sign-in')}>Sign in to organization portal</Button>}
              {(data.status === 'none' || data.status === 'rejected' || data.status === 'removed') && <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/organization/request-access')}>{data.status === 'none' ? 'Request organization access' : data.status === 'removed' ? 'Request re-appointment' : 'Submit a new request'}</Button>}
              <Button variant="secondary" onClick={() => navigate('/home')}>Continue as participant</Button>
            </div>
            <p className="mt-6 text-center text-xs text-charcoal-500">Per Seminex charter, officer access is governed by adviser endorsement and academic-cycle review.</p>
          </>
        )}
      </main>
    </div>
  );
}
