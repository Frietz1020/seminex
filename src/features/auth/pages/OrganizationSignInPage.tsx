import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type ApiErrorCode, type OrgAccess } from '../../../api/client';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { StudentIdField } from '../../../components/auth/StudentIdField';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { PasswordField } from '../../../components/ui/PasswordField';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useSession } from '../../../session/useSession';
import { validateSignInPassword, validateStudentId } from '../validation';

type FieldName = 'studentId' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;
type NoOrgAccess = Exclude<OrgAccess, 'organization' | 'adviser'>;

function validate(field: FieldName, value: string): string | undefined {
  return field === 'studentId' ? validateStudentId(value) : validateSignInPassword(value);
}

const NO_ACCESS_COPY: Record<NoOrgAccess, { title: string; body: string }> = {
  pending: {
    title: 'Your request is waiting for approval',
    body: 'Your organization access request is still pending approval. You can use the participant portal until then.',
  },
  rejected: {
    title: 'Your request was not approved',
    body: 'Contact your organization about the decision, or submit a new access request.',
  },
  none: {
    title: 'This account has no organization access',
    body: 'Request organization access for your account, or continue using the participant portal in the meantime.',
  },
};

export default function OrganizationSignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const online = useOnlineStatus();
  const session = useSession();

  const studentIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const offlineRef = useRef<HTMLDivElement>(null);
  const noAccessRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState({ studentId: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [noAccess, setNoAccess] = useState<NoOrgAccess | null>(null);
  const [pending, setPending] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  useEffect(() => {
    document.title = 'Organization sign in - Seminex';
  }, []);

  useEffect(() => {
    if (noAccess) noAccessRef.current?.focus();
  }, [noAccess]);

  // Someone who is already signed in with org access goes straight to the org portal.
  if (session?.role === 'org_member') return <Navigate to="/org" replace />;
  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;

  const sessionExpired = searchParams.get('reason') === 'session-expired' || failure === 'session_expired';

  function setField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: validate(field, value) }));
    }
  }

  function handleBlur(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: validate(field, values[field]) }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const next: FieldErrors = {
      studentId: validate('studentId', values.studentId),
      password: validate('password', values.password),
    };
    setErrors(next);
    if (next.studentId) {
      studentIdRef.current?.focus();
      return;
    }
    if (next.password) {
      passwordRef.current?.focus();
      return;
    }
    if (!online) {
      offlineRef.current?.focus();
      return;
    }

    setFailure(null);
    setNoAccess(null);
    setPending(true);
    const result = await api.orgSignIn({ identifier: values.studentId.trim(), password: values.password });
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

  const showAlerts =
    !online ||
    sessionExpired ||
    failure !== null ||
    noAccess !== null;

  return (
    <AuthLayout
      fixed
      brandMessage="Create and streamline your organization's seminars with Seminex."
      brandSupportingText="Coordinate events, manage registrations, and support student participation in one place."
      footer={
        <p className="text-sm text-charcoal-700">
          Need officer access?{' '}
          <button
            type="button"
            onClick={() => setShowSignupPrompt(true)}
            className="ml-1 inline-flex min-h-11 items-center font-semibold text-maroon hover:underline"
          >
            Create an organization account
          </button>
        </p>
      }
    >
      <Link to="/" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon">
        <Icon name="arrow_back" size={16} />
        Back to portal selection
      </Link>
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-2xl font-bold text-charcoal-900 md:text-3xl">Organization sign in</h1>
        <p className="mt-1.5 text-base text-charcoal-700 md:mt-2">Use your student ID to continue.</p>
      </div>

      {showAlerts && (
        <div className="mb-5 space-y-3">
          {!online && (
            <Alert ref={offlineRef} variant="neutral" role="status" icon="cloud_off" title="You are offline">
              Connect to the internet to sign in. What you typed is kept.
            </Alert>
          )}
          {sessionExpired && (
            <Alert variant="warning" icon="schedule" title="Session expired">
              Your session ended. Sign in again to continue.
            </Alert>
          )}
          {failure === 'invalid_credentials' && (
            <Alert variant="error" icon="warning" title="Authentication failed">
              Student ID or password is incorrect. Check both and try again.
            </Alert>
          )}
          {failure === 'network' && online && (
            <Alert variant="error" icon="warning" title="Connection problem">
              Seminex could not be reached. Check your connection and try again.
            </Alert>
          )}
          {failure === 'configuration_error' && (
            <Alert variant="error" icon="warning" title="Sign in is not configured">
              Set the Supabase project URL and publishable key in the app environment, then reload.
            </Alert>
          )}
          {failure !== null && failure !== 'invalid_credentials' && failure !== 'network' && failure !== 'configuration_error' && failure !== 'session_expired' && (
            <Alert variant="error" icon="warning" title="Authentication failed">
              Something went wrong. Try again.
            </Alert>
          )}
          {noAccess && (
            <>
              <Alert ref={noAccessRef} variant="warning" role="status" icon="info" title={NO_ACCESS_COPY[noAccess].title}>
                {NO_ACCESS_COPY[noAccess].body}
              </Alert>
              <Button onClick={() => navigate('/home', { replace: true })}>Open participant portal</Button>
              {noAccess === 'pending' && (
                <Button variant="secondary" onClick={() => navigate('/organization/request-status')}>
                  View request status
                </Button>
              )}
              {(noAccess === 'none' || noAccess === 'rejected') && (
                <Button variant="secondary" onClick={() => navigate('/organization/request-access')}>
                  {noAccess === 'rejected' ? 'Submit a new access request' : 'Request organization access'}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} aria-busy={pending} className="space-y-5">
        <StudentIdField
          ref={studentIdRef}
          id="organization-student-id"
          value={values.studentId}
          error={errors.studentId}
          readOnly={pending}
          onChange={(value) => setField('studentId', value)}
          onBlur={() => handleBlur('studentId')}
        />

        <div>
          <PasswordField
            ref={passwordRef}
            id="organization-password"
            label="Password"
            required
            autoComplete="current-password"
            value={values.password}
            error={errors.password}
            readOnly={pending}
            onChange={(value) => setField('password', value)}
            onBlur={() => handleBlur('password')}
          />
          <div className="mt-1 flex justify-end">
            <Link
              to="/forgot-password"
              state={{ returnTo: '/organization/sign-in' }}
              className="inline-flex min-h-11 items-center text-sm font-medium text-maroon hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="mt-4"
          loading={pending}
          loadingLabel="Signing in..."
        >
          Sign in
        </Button>

        <p role="status" className="sr-only">
          {pending ? 'Signing in' : ''}
        </p>
      </form>

      <Dialog open={showSignupPrompt} onClose={() => setShowSignupPrompt(false)} title="Do you already have an account in the applicant domain?">
        <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
          Are you already signed in on the applicant side? If so, we can use your student profile to set up organization access.
        </p>
        <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => { setShowSignupPrompt(false); navigate('/organization/sign-up'); }}>No, create an account</Button>
          <Button onClick={() => {
            setShowSignupPrompt(false);
            navigate('/organization/sign-up?applicant=1');
          }}>Yes, continue</Button>
        </div>
      </Dialog>
    </AuthLayout>
  );
}
