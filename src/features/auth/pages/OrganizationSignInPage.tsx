import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Info, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode, type OrgAccess } from '../../../api/client';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PasswordField } from '../../../components/ui/PasswordField';
import { TextField } from '../../../components/ui/TextField';
import { STUDENT_EMAIL_DOMAIN } from '../../../config';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useSession } from '../../../session/useSession';
import { validateSignInPassword } from '../validation';

type Errors = Partial<Record<'identifier' | 'password', string>>;
type NoOrgAccess = Exclude<OrgAccess, 'organization' | 'adviser'>;

const FACULTY_EMAIL = new RegExp(`^[^\\s@]+@${STUDENT_EMAIL_DOMAIN.replace('.', '\\.')}$`, 'i');

/** A Student ID is 9 digits starting with 20. A faculty email ends with the college domain. */
function validateIdentifier(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^20\d{7}$/.test(trimmed) || FACULTY_EMAIL.test(trimmed)) return undefined;
  return trimmed.includes('@')
    ? `Faculty email must end with @${STUDENT_EMAIL_DOMAIN}.`
    : `Enter a Student ID (9 digits, starting with 20) or a faculty email ending in @${STUDENT_EMAIL_DOMAIN}.`;
}

const NO_ACCESS_COPY: Record<NoOrgAccess, { title: string; body: string }> = {
  pending: {
    title: 'Your request is waiting for approval',
    body: 'Your adviser has not approved your organization request yet. You can use the participant portal until then.',
  },
  rejected: {
    title: 'Your request was not approved',
    body: 'Ask your adviser about the decision, or create an organization account to send a new request.',
  },
  none: {
    title: 'This account has no organization access',
    body: 'Create an organization account to send a request to your adviser. You can use the participant portal in the meantime.',
  },
};

export default function OrganizationSignInPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const session = useSession();
  const [values, setValues] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [noAccess, setNoAccess] = useState<NoOrgAccess | null>(null);
  const [pending, setPending] = useState(false);
  const offlineRef = useRef<HTMLDivElement>(null);
  const noAccessRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Organization sign in - Seminex';
  }, []);

  useEffect(() => {
    if (noAccess) noAccessRef.current?.focus();
  }, [noAccess]);

  // Someone who is already signed in with org access goes straight to the org portal.
  if (session?.role === 'org_member') return <Navigate to="/org" replace />;
  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      identifier: validateIdentifier(values.identifier),
      password: validateSignInPassword(values.password),
    };
    setErrors(next);
    if (next.identifier || next.password) return;
    if (!online) {
      offlineRef.current?.focus();
      return;
    }
    setFailure(null);
    setNoAccess(null);
    setPending(true);
    const result = await api.orgSignIn({ identifier: values.identifier.trim(), password: values.password });
    setPending(false);
    if (!result.ok) {
      setFailure(result.error.code);
      return;
    }
    const { access } = result.data;
    if (access === 'organization') navigate('/org', { replace: true });
    else if (access === 'adviser') navigate('/org/adviser', { replace: true });
    else setNoAccess(access);
  }

  return (
    <AuthLayout width="wide">
      <div className="mb-5 flex items-center justify-between">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to portal selection
        </Link>
      </div>
      <div className="mb-6 inline-flex items-center gap-2 rounded-md bg-cream-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-maroon">
        <Building2 aria-hidden="true" className="h-4 w-4" />
        Organization portal
      </div>
      <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">Organization sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-700">
        Officers sign in with their Student ID. Advisers sign in with their faculty email.
      </p>

      <div className="my-6 space-y-3">
        {!online && (
          <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">
            Connect to the internet to sign in. Your entries are kept.
          </Alert>
        )}
        {failure === 'invalid_credentials' && (
          <Alert variant="error" icon={TriangleAlert} title="Sign in failed">
            The Student ID, faculty email, or password is incorrect. Check them and try again.
          </Alert>
        )}
        {failure === 'network' && online && (
          <Alert variant="error" icon={TriangleAlert} title="Connection problem">
            Seminex could not be reached. Check your connection and try again.
          </Alert>
        )}
        {failure !== null && failure !== 'invalid_credentials' && failure !== 'network' && (
          <Alert variant="error" icon={TriangleAlert} title="Sign in failed">
            Something went wrong. Try again.
          </Alert>
        )}
        {noAccess && (
          <>
            <Alert ref={noAccessRef} variant="warning" role="status" icon={Info} title={NO_ACCESS_COPY[noAccess].title}>
              {NO_ACCESS_COPY[noAccess].body}
            </Alert>
            <Button onClick={() => navigate('/home', { replace: true })}>Open participant portal</Button>
            {noAccess === 'pending' && <Button variant="secondary" onClick={() => navigate('/organization/request-status')}>View request status</Button>}
            {(noAccess === 'none' || noAccess === 'rejected') && <Button variant="secondary" onClick={() => navigate('/organization/request-access')}>{noAccess === 'rejected' ? 'Submit a new access request' : 'Request organization access'}</Button>}
          </>
        )}
      </div>

      <form noValidate onSubmit={submit} aria-busy={pending} className="space-y-5 rounded-2xl bg-white p-5 shadow-control md:p-7">
        <TextField
          id="organization-identifier"
          label="Student ID or faculty email"
          required
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={values.identifier}
          error={errors.identifier}
          readOnly={pending}
          onChange={(identifier) => setValues((current) => ({ ...current, identifier }))}
          onBlur={() => setErrors((current) => ({ ...current, identifier: validateIdentifier(values.identifier) }))}
        />
        <div>
          <PasswordField
            id="organization-password"
            label="Password"
            required
            autoComplete="current-password"
            value={values.password}
            error={errors.password}
            readOnly={pending}
            onChange={(password) => setValues((current) => ({ ...current, password }))}
            onBlur={() => setErrors((current) => ({ ...current, password: validateSignInPassword(values.password) }))}
          />
          <div className="mt-1 flex justify-end">
            <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-maroon hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={pending} loadingLabel="Signing in..." icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-charcoal-700">
        Need officer access?{' '}
        <Link to="/organization/sign-up" className="ml-1 font-semibold text-maroon hover:underline">
          Create an organization account
        </Link>
      </p>
    </AuthLayout>
  );
}
