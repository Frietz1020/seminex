import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CircleAlert, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode } from '../../../api/client';
import { BrandMark } from '../../../components/shell/BrandMark';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PasswordField } from '../../../components/ui/PasswordField';
import { TextField } from '../../../components/ui/TextField';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useSession } from '../../../session/useSession';
import { validateSignInPassword } from '../../auth/validation';

type Errors = Partial<Record<'email' | 'password', string>>;

export default function AdminSignInPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const session = useSession();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiErrorCode | 'not_adviser' | null>(null);
  const [pending, setPending] = useState(false);
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Admin sign in - Seminex'; }, []);

  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;
  if (session?.role === 'org_member') return <Navigate to="/org" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = values.email.trim();
    const next: Errors = {
      email: /^[^\s@]+@gordoncollege\.edu\.ph$/i.test(email) ? undefined : 'Enter your Gordon College faculty email.',
      password: validateSignInPassword(values.password),
    };
    setErrors(next);
    if (next.email || next.password) return;
    if (!online) { offlineRef.current?.focus(); return; }
    setFailure(null);
    setPending(true);
    const result = await api.orgSignIn({ identifier: email, password: values.password });
    setPending(false);
    if (!result.ok) { setFailure(result.error.code); return; }
    if (result.data.access === 'adviser') navigate('/org/adviser', { replace: true });
    else setFailure('not_adviser');
  }

  return (
    <div className="min-h-dvh bg-cream-50 md:flex">
      <aside className="relative hidden min-h-dvh w-[42%] flex-col justify-between overflow-hidden bg-maroon p-10 text-white md:flex lg:w-1/2 lg:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3"><BrandMark size={48} variant="onDark" /><span><strong className="block font-heading text-2xl">Seminex</strong><small className="uppercase tracking-widest text-cream-200">CCS Gordon College</small></span></div>
        <div className="relative z-10 my-auto max-w-lg py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cream-200"><ShieldCheck className="h-4 w-4" />Faculty identity authority</span>
          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight">Governance &amp; Administration</h1>
          <p className="mt-4 text-lg leading-relaxed text-cream-100">Academic oversight, faculty advisorship, and organization governance.</p>
          <p className="mt-4 leading-relaxed text-cream-100/80">Centralized administrative access for recognized student organizations and faculty review.</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/10 p-4"><span className="block text-xs font-semibold uppercase tracking-wider text-cream-200">Affiliated student orgs</span><strong className="mt-2 block font-heading text-3xl">14</strong></div>
            <div className="rounded-xl bg-white/10 p-4"><span className="block text-xs font-semibold uppercase tracking-wider text-cream-200">Accredited review system</span><strong className="mt-2 block font-heading text-3xl">100%</strong></div>
          </div>
        </div>
        <p className="relative z-10 border-t border-white/15 pt-5 text-sm text-cream-200/80">College of Computer Studies · Gordon College Administrative Gateway · Olongapo City</p>
      </aside>

      <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8 sm:px-10 md:py-12">
        <div className="w-full max-w-[480px]">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Back to portal selection</Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-maroon"><ShieldCheck className="h-4 w-4" />Institutional access</span>
          </div>
          <div className="mb-5 flex items-center gap-3 md:hidden"><BrandMark size={40} /><span><strong className="block font-heading text-xl text-charcoal-900">Seminex CCS</strong><small className="text-xs uppercase tracking-wide text-burnt">Gordon College Identity Gateway</small></span></div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-cream-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-maroon"><Building2 className="h-4 w-4" />Admin portal · CCS Gordon College</div>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-charcoal-900">Admin Sign in</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-700">Enter your faculty credentials to manage organization memberships.</p>

          <div className="my-5 space-y-3">
            {!online && <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">Connect to the internet to verify faculty credentials.</Alert>}
            {failure === 'invalid_credentials' && <Alert variant="error" icon={TriangleAlert} title="Authentication failed">Invalid faculty credentials. Check your email and password.</Alert>}
            {failure === 'network' && online && <Alert variant="error" icon={TriangleAlert} title="Connection problem">Seminex could not be reached. Check your connection and try again.</Alert>}
            {failure === 'not_adviser' && <Alert variant="error" icon={TriangleAlert} title="Admin access required">This account does not have faculty adviser access.</Alert>}
            {failure !== null && failure !== 'invalid_credentials' && failure !== 'network' && failure !== 'not_adviser' && <Alert variant="error" icon={TriangleAlert} title="Sign in failed">Something went wrong. Try again.</Alert>}
          </div>

          <form noValidate onSubmit={submit} aria-busy={pending} className="space-y-5 rounded-2xl bg-white p-5 shadow-control md:p-7">
            <TextField id="admin-email" label="Faculty email address" required type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="name@gordoncollege.edu.ph" value={values.email} error={errors.email} readOnly={pending} onChange={(email) => setValues((current) => ({ ...current, email }))} onBlur={() => setErrors((current) => ({ ...current, email: /^[^\s@]+@gordoncollege\.edu\.ph$/i.test(values.email.trim()) ? undefined : 'Enter your Gordon College faculty email.' }))} />
            <div><PasswordField id="admin-password" label="Password" required autoComplete="current-password" value={values.password} error={errors.password} readOnly={pending} onChange={(password) => setValues((current) => ({ ...current, password }))} onBlur={() => setErrors((current) => ({ ...current, password: validateSignInPassword(values.password) }))} /><div className="mt-1 flex justify-end"><Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-maroon hover:underline">Forgot password?</Link></div></div>
            <Button type="submit" loading={pending} loadingLabel="Signing in..." icon={<ArrowRight className="h-4 w-4" />}>Sign in as Admin</Button>
            <div className="-mx-5 -mb-5 flex items-start gap-2 rounded-b-2xl bg-cream-100 px-5 py-4 text-xs leading-relaxed text-charcoal-700 md:-mx-7 md:-mb-7 md:px-7"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-maroon" /><span><strong>Controlled faculty access.</strong> Registration is disabled. Accounts are provisioned for authorized Gordon College CCS advisers and faculty administrators.</span></div>
          </form>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-charcoal-500"><WifiOff className="h-4 w-4" /><span>Offline access is unavailable. Sign-in resumes when the network is restored.</span></div>
        </div>
      </main>
    </div>
  );
}
