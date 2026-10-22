import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarDays, CircleAlert, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode } from '../../../api/client';
import { BrandMark } from '../../../components/shell/BrandMark';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useResource } from '../../../hooks/useResource';
import { useNow } from '../../../hooks/useNow';
import { useSession } from '../../../session/useSession';
import { STUDENT_EMAIL_DOMAIN } from '../../../config';
import { getAcademicPeriod } from '../../seminars/academicPeriod';
import { validateSelection } from '../../auth/validation';

const POSITIONS = [
  'Event Director / Committee Head', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'Public Relations Officer',
].map((label) => ({ value: label, label }));

export default function RequestOrganizationAccessPage() {
  const navigate = useNavigate();
  const session = useSession();
  const online = useOnlineStatus();
  const period = getAcademicPeriod(useNow());
  const { state: profileState, reload: reloadProfile } = useResource(() => api.getProfile(), `request-access-profile-${session?.studentId ?? ''}`);
  const { state: orgState, reload: reloadOrgs } = useResource(() => api.listOrganizations(), 'request-access-organizations');
  const { state: requestState } = useResource(() => api.getMyOrgAccessStatus(), `request-access-existing-${session?.studentId ?? ''}`);
  const organizations = orgState.status === 'success' ? orgState.data.map((organization) => ({ value: organization.id, label: organization.name })) : [];
  const [organizationId, setOrganizationId] = useState('');
  const [position, setPosition] = useState('');
  const [statement, setStatement] = useState('');
  const [errors, setErrors] = useState<{ organization?: string; position?: string; statement?: string }>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Request organization access - Seminex'; }, []);

  if (session?.role === 'org_member') return <Navigate to="/org" replace />;
  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;
  if (requestState.status === 'success' && ['pending', 'approved'].includes(requestState.data.status)) {
    return <Navigate to="/organization/request-status" replace />;
  }

  const profile = profileState.status === 'success' ? profileState.data : null;
  const fullName = profile ? [profile.firstName, profile.middleInitial && `${profile.middleInitial}.`, profile.lastName].filter(Boolean).join(' ') : '';
  const academic = profile ? `${profile.program === 'CS' ? 'BS Computer Science' : profile.program === 'IT' ? 'BS Information Technology' : 'BS Entertainment and Multimedia Computing'} (${profile.program} ${profile.yearLevel}-${profile.block})` : '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      organization: validateSelection(organizationId, 'Organization'),
      position: validateSelection(position, 'Officer position'),
      statement: statement.length <= 300 ? undefined : 'Keep the statement to 300 characters or fewer.',
    };
    setErrors(next);
    if (next.organization || next.position || next.statement || !profile) return;
    if (!online) { offlineRef.current?.focus(); return; }
    setFailure(null);
    setPending(true);
    const result = await api.submitOrgAccessRequest({ organizationId, position, statement: statement.trim(), fullName });
    setPending(false);
    if (result.ok) navigate('/organization/request-status', { replace: true, state: { submitted: true } });
    else setFailure(result.error.code);
  }

  return (
    <div className="min-h-dvh bg-cream-50 md:flex">
      <aside className="relative hidden min-h-dvh w-[42%] flex-col justify-between overflow-hidden bg-maroon p-10 text-white md:flex lg:w-[40%] lg:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3"><BrandMark size={44} variant="onDark" /><span><strong className="block font-heading text-2xl">Seminex CCS</strong><small className="text-cream-200">Administrative &amp; Org Core</small></span></div>
        <div className="relative z-10 my-auto max-w-md py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-cream-200">Organization access</p>
          <h1 className="mt-4 font-heading text-3xl font-bold leading-tight lg:text-4xl">Elevate your student role to organization officer.</h1>
          <p className="mt-4 leading-relaxed text-cream-100/85">Active participants can request officer authorization to organize accredited seminars, supervise registration quotas, and validate campus attendance.</p>
          <div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><strong className="block font-heading text-2xl">48 Hrs</strong><span className="text-xs text-cream-200">Adviser clearance cycle</span></div><div className="rounded-xl bg-white/10 p-4"><strong className="block font-heading text-2xl">100%</strong><span className="text-xs text-cream-200">Audited charter logs</span></div></div>
          <div className="mt-7 space-y-3 text-sm"><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-cream-200" /><span><strong>Faculty sponsor endorsement</strong><br /><span className="text-cream-100/75">An adviser reviews the request before access is granted.</span></span></p><p className="flex gap-3"><BadgeCheck className="h-5 w-5 shrink-0 text-cream-200" /><span><strong>Participant access continues</strong><br /><span className="text-cream-100/75">Your student seminar access remains available while you wait.</span></span></p></div>
        </div>
        <p className="relative z-10 border-t border-white/15 pt-4 text-xs text-cream-200/75">© {period.academicYear} Seminex Collegiate Division</p>
      </aside>

      <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8 sm:px-10 md:py-12">
        <div className="w-full max-w-[560px]">
          <header className="mb-5 flex items-center justify-between"><Link to="/home" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Back to participant portal</Link><span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-charcoal-700"><CalendarDays className="h-4 w-4" />AY {period.academicYear}</span></header>
          <div className="mb-5 flex items-center gap-3 md:hidden"><BrandMark size={40} /><span><strong className="block font-heading text-xl text-charcoal-900">Seminex CCS</strong><small className="text-xs text-burnt">Administrative &amp; Org Core</small></span></div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-cream-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-maroon"><Building2 className="h-4 w-4" />Seminex CCS Gordon College</div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">Request Organization Access</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-700">Submit your officer appointment details for faculty adviser endorsement and organization permissions.</p>

          {!online && <div className="my-4"><Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">Connect to the internet to submit your request. Your information is kept.</Alert></div>}
          {failure && <div className="my-4"><Alert variant="error" icon={TriangleAlert} title={failure === 'network' ? 'Connection problem' : 'Request not submitted'}>{failure === 'network' ? 'Seminex could not be reached. Check your connection and try again.' : 'Your request could not be submitted. Try again.'}</Alert></div>}

          <form noValidate onSubmit={submit} aria-busy={pending} className="mt-5 space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
            <section className="rounded-xl border border-charcoal-200 bg-cream-50 p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-600">Verified campus identity</p><span className="inline-flex items-center gap-1 text-xs font-bold text-success"><BadgeCheck className="h-4 w-4" />Verified</span></div>
              {profileState.status === 'loading' ? <LoadingRegion label="Loading verified account"><Skeleton className="mt-3 h-5 w-2/3" /><Skeleton className="mt-2 h-4 w-full" /></LoadingRegion> : profile ? <><p className="mt-3 font-semibold text-charcoal-900">{fullName}</p><p className="mt-1 text-sm text-charcoal-700">{profile.studentId} · {academic}</p><p className="mt-1 text-sm text-charcoal-600">{profile.studentId}@{STUDENT_EMAIL_DOMAIN}</p></> : <InlineError onRetry={reloadProfile}>Your verified student identity could not be loaded.</InlineError>}
            </section>

            {orgState.status === 'error' && <InlineError onRetry={reloadOrgs}>Recognized organizations could not be loaded.</InlineError>}
            <SelectField id="request-organization" label="Recognized student organization" required placeholder={orgState.status === 'loading' ? 'Loading organizations…' : 'Select your organization'} options={organizations} value={organizationId} error={errors.organization} disabled={orgState.status !== 'success'} onChange={(value) => setOrganizationId(value)} />
            <SelectField id="request-position" label="Officer position" required placeholder="Select your appointed position" options={POSITIONS} value={position} error={errors.position} onChange={(value) => setPosition(value)} />
            <div><label htmlFor="request-statement" className="mb-2 block text-sm font-semibold text-charcoal-900">Brief statement / mandate note <span className="font-normal text-charcoal-500">(Optional)</span></label><textarea id="request-statement" maxLength={300} rows={3} value={statement} onChange={(event) => setStatement(event.target.value)} aria-describedby="statement-count" className="w-full resize-y rounded-control border border-charcoal-300 bg-white px-3.5 py-3 text-sm text-charcoal-900 outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/30" placeholder="Briefly describe your appointment or mandate." /><div id="statement-count" className="mt-1 flex justify-between text-xs text-charcoal-500"><span>Maximum 300 characters</span><span>{statement.length} / 300</span></div>{errors.statement && <p className="mt-1 text-sm text-danger">{errors.statement}</p>}</div>
            <div className="rounded-xl border border-charcoal-200 bg-cream-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Appointment academic term</p><p className="mt-2 flex items-center gap-2 font-semibold text-charcoal-900"><CalendarDays className="h-4 w-4 text-maroon" />Academic Year {period.academicYear}</p><p className="mt-1 text-xs text-success">Active cycle · set by the Seminex academic calendar</p></div>
            <div className="rounded-xl border border-maroon/15 bg-maroon/5 p-4 text-sm leading-relaxed text-charcoal-700"><strong className="mb-1 flex items-center gap-2 text-charcoal-900"><ShieldCheck className="h-4 w-4 text-maroon" />Advisory verification notice</strong>An appointed faculty adviser reviews your request. You can continue using your participant privileges while officer access is pending.</div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => navigate('/home')}>Cancel</Button><Button type="submit" loading={pending} loadingLabel="Submitting request…" disabled={!profile || orgState.status !== 'success'} icon={<ArrowRight className="h-4 w-4" />}>Submit officer request</Button></div>
          </form>
          <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs text-charcoal-500"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Experiencing issues? Contact the CCS Student Council Secretariat.</p>
        </div>
      </main>
    </div>
  );
}
