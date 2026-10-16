import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode } from '../../../api/client';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { StudentIdField } from '../../../components/auth/StudentIdField';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PasswordField } from '../../../components/ui/PasswordField';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { validateSignInPassword, validateStudentId } from '../validation';

type Errors = Partial<Record<'studentId' | 'password', string>>;

export default function OrganizationSignInPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [values, setValues] = useState({ studentId: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Organization sign in - Seminex'; }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      studentId: validateStudentId(values.studentId),
      password: validateSignInPassword(values.password),
    };
    setErrors(next);
    if (next.studentId || next.password) return;
    if (!online) { offlineRef.current?.focus(); return; }
    setFailure(null);
    setPending(true);
    const result = await api.signIn(values);
    setPending(false);
    if (result.ok) navigate('/home', { replace: true });
    else setFailure(result.error.code);
  }

  return (
    <AuthLayout width="wide">
      <div className="mb-5 flex items-center justify-between">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Back to portal selection</Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-maroon"><ShieldCheck className="h-4 w-4" />Institutional access</span>
      </div>
      <div className="mb-6 inline-flex items-center gap-2 rounded-md bg-cream-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-maroon"><Building2 className="h-4 w-4" />Seminex · CCS Gordon College</div>
      <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">Organization Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-700">Use your council officer student ID to manage seminars.</p>

      <div className="my-6 space-y-3">
        {!online && <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">Connect to the internet to sign in. Your entries are kept.</Alert>}
        {failure === 'invalid_credentials' && <Alert variant="error" icon={TriangleAlert} title="Authentication failed">Student ID or password is incorrect. Check both and try again.</Alert>}
        {failure === 'network' && online && <Alert variant="error" icon={TriangleAlert} title="Connection problem">Seminex could not be reached. Check your connection and try again.</Alert>}
      </div>

      <form noValidate onSubmit={submit} aria-busy={pending} className="space-y-5 rounded-2xl bg-white p-5 shadow-control md:p-7">
        <StudentIdField id="organization-student-id" value={values.studentId} error={errors.studentId} readOnly={pending} onChange={(studentId) => setValues((current) => ({ ...current, studentId }))} onBlur={() => setErrors((current) => ({ ...current, studentId: validateStudentId(values.studentId) }))} />
        <div>
          <PasswordField id="organization-password" label="Password" required autoComplete="current-password" value={values.password} error={errors.password} readOnly={pending} onChange={(password) => setValues((current) => ({ ...current, password }))} onBlur={() => setErrors((current) => ({ ...current, password: validateSignInPassword(values.password) }))} />
          <div className="mt-1 flex justify-end"><Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-maroon hover:underline">Forgot password?</Link></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal-700"><input type="checkbox" className="h-4 w-4 accent-maroon" />Keep officer session verified on this workstation</label>
        <Button type="submit" loading={pending} loadingLabel="Signing in..." icon={<ArrowRight className="h-4 w-4" />}>Sign in</Button>
        <div className="-mx-5 -mb-5 flex items-center gap-2 rounded-b-2xl bg-cream-100 px-5 py-4 text-xs text-charcoal-700 md:-mx-7 md:-mb-7 md:px-7"><ShieldCheck className="h-4 w-4 shrink-0 text-maroon" />Authorized for designated CCS Student Council officers and wing moderators.</div>
      </form>
      <p className="mt-5 text-center text-sm text-charcoal-700">Need officer access? <Link to="/organization/sign-up" className="ml-1 font-semibold text-maroon hover:underline">Create an account</Link></p>
      <p className="mt-5 rounded-xl border border-charcoal-200 bg-white/70 p-3 text-xs leading-relaxed text-charcoal-600">This portal currently uses Seminex student sign-in. The project does not yet verify organization officer roles, so successful sign-in opens the participant portal.</p>
      <p className="mt-4 text-center text-xs text-charcoal-500">Gordon College Olongapo <span className="mx-2">•</span> CCS Computing Laboratory Network</p>
    </AuthLayout>
  );
}
