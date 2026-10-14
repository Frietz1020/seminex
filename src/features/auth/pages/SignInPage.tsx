import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode } from '../../../api/client';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { StudentIdField } from '../../../components/auth/StudentIdField';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PasswordField } from '../../../components/ui/PasswordField';
import { validateSignInPassword, validateStudentId } from '../validation';

type FieldName = 'studentId' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;
type Pending = 'credentials' | null;

// Temporary post-login target until post-login screens exist.
const AFTER_SIGN_IN_PATH = '/seminars';

function validate(field: FieldName, value: string): string | undefined {
  return field === 'studentId' ? validateStudentId(value) : validateSignInPassword(value);
}

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const online = useOnlineStatus();

  const studentIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const offlineRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState({ studentId: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);

  useEffect(() => {
    document.title = 'Sign in - Seminex';
  }, []);

  const sessionExpired = searchParams.get('reason') === 'session-expired' || failure === 'session_expired';
  const locked = pending !== null;

  function setField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Once a field shows an error, re-validate as the person types.
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: validate(field, value) }));
    }
  }

  function handleBlur(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: validate(field, values[field]) }));
  }

  function finish(result: Awaited<ReturnType<typeof api.signIn>>) {
    setPending(null);
    if (result.ok) {
      navigate(AFTER_SIGN_IN_PATH, { replace: true });
    } else {
      setFailure(result.error.code);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;

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
    setPending('credentials');
    finish(await api.signIn({ studentId: values.studentId, password: values.password }));
  }

  const showAlerts = !online || sessionExpired || failure === 'invalid_credentials' || failure === 'network';

  return (
    <AuthLayout
      footer={
        <p className="text-sm text-charcoal-700">
          New to Seminex?{' '}
          <Link
            to="/sign-up"
            className="ml-1 inline-flex min-h-11 items-center font-semibold text-maroon hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">Sign in</h1>
        <p className="mt-1.5 text-base text-charcoal-700 md:mt-2">Use your student ID to continue.</p>
      </div>

      {showAlerts && (
        <div className="mb-5 space-y-3">
          {!online && (
            <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">
              Connect to the internet to sign in. What you typed is kept.
            </Alert>
          )}
          {sessionExpired && (
            <Alert variant="warning" icon={Clock} title="Session expired">
              Your session ended. Sign in again to continue.
            </Alert>
          )}
          {failure === 'invalid_credentials' && (
            <Alert variant="error" icon={TriangleAlert} title="Authentication failed">
              Student ID or password is incorrect. Check both and try again.
            </Alert>
          )}
          {failure === 'network' && online && (
            <Alert variant="error" icon={TriangleAlert} title="Connection problem">
              Seminex could not be reached. Check your connection and try again.
            </Alert>
          )}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} aria-busy={locked} className="space-y-5">
        <StudentIdField
          ref={studentIdRef}
          id="student-id"
          value={values.studentId}
          error={errors.studentId}
          readOnly={locked}
          onChange={(value) => setField('studentId', value)}
          onBlur={() => handleBlur('studentId')}
        />

        <div>
          <PasswordField
            ref={passwordRef}
            id="password"
            label="Password"
            required
            autoComplete="current-password"
            value={values.password}
            error={errors.password}
            readOnly={locked}
            onChange={(value) => setField('password', value)}
            onBlur={() => handleBlur('password')}
          />
          <div className="mt-1 flex justify-end">
            <Link
              to="/forgot-password"
              className="inline-flex min-h-11 items-center text-sm font-medium text-maroon hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="mt-4"
          loading={pending === 'credentials'}
          loadingLabel="Signing in..."
        >
          Sign in
        </Button>

        <p role="status" className="sr-only">
          {pending === 'credentials' ? 'Signing in' : ''}
        </p>
      </form>
    </AuthLayout>
  );
}