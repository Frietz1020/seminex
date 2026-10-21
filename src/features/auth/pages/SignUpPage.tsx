import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode, type Block, type Program, type YearLevel } from '../../../api/client';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { PasswordRules } from '../../../components/auth/PasswordRules';
import { StudentIdField } from '../../../components/auth/StudentIdField';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PasswordField } from '../../../components/ui/PasswordField';
import { SelectField } from '../../../components/ui/SelectField';
import { BLOCKS, PROGRAMS, YEAR_LEVELS } from '../../../data/academic';
import { TextField } from '../../../components/ui/TextField';
import {
  sanitizeMiddleInitial,
  validateNewPassword,
  validateRequiredName,
  validateSelection,
  validateStudentId,
} from '../validation';

type FieldName = 'studentId' | 'password' | 'lastName' | 'firstName' | 'program' | 'yearLevel' | 'block';
type FieldErrors = Partial<Record<FieldName, string>>;
type Pending = 'submit' | null;
type Step = 1 | 2;

interface FormValues {
  studentId: string;
  password: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  program: string;
  yearLevel: string;
  block: string;
}

const INITIAL_VALUES: FormValues = {
  studentId: '',
  password: '',
  lastName: '',
  firstName: '',
  middleInitial: '',
  program: '',
  yearLevel: '',
  block: '',
};

const STEP_ONE_FIELDS: readonly FieldName[] = ['studentId', 'password'];
const STEP_TWO_FIELDS: readonly FieldName[] = ['lastName', 'firstName', 'program', 'yearLevel', 'block'];
const ALL_FIELDS: readonly FieldName[] = [...STEP_ONE_FIELDS, ...STEP_TWO_FIELDS];

const REASON_ID = 'create-account-reason';

function validateField(field: FieldName, values: FormValues): string | undefined {
  switch (field) {
    case 'studentId':
      return validateStudentId(values.studentId);
    case 'password':
      return validateNewPassword(values.password);
    case 'lastName':
      return validateRequiredName(values.lastName, 'Last name');
    case 'firstName':
      return validateRequiredName(values.firstName, 'First name');
    case 'program':
      return validateSelection(values.program, 'Program');
    case 'yearLevel':
      return validateSelection(values.yearLevel, 'Year level');
    case 'block':
      return validateSelection(values.block, 'Block');
  }
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:space-y-5 md:p-6"
    >
      <div className="md:border-b md:border-charcoal-200 md:pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-burnt">{eyebrow}</p>
        <h2
          id={id}
          className="mt-0.5 font-heading text-lg font-bold text-charcoal-900"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const fieldRefs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLSelectElement | null>>>({});
  const stepBadgeRef = useRef<HTMLParagraphElement>(null);
  const offlineRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [focusTarget, setFocusTarget] = useState<FieldName | 'step' | null>(null);

  useEffect(() => {
    document.title = 'Create an account - Seminex';
  }, []);

  // Focus is moved after the render that mounts the target, because the inactive step is not rendered on mobile.
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget === 'step') {
      stepBadgeRef.current?.focus();
    } else {
      fieldRefs.current[focusTarget]?.focus();
    }
    setFocusTarget(null);
  }, [focusTarget, step]);

  const locked = pending !== null;
  const allValid = ALL_FIELDS.every((field) => !validateField(field, values));
  const showCredentials = step === 1;
  const showPersonal = step === 2;

  function setField(field: keyof FormValues, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field shows an error, re-validate as the person types.
    if (field !== 'middleInitial' && errors[field]) {
      setErrors((current) => ({ ...current, [field]: validateField(field, next) }));
    }
  }

  function handleBlur(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: validateField(field, values) }));
  }

  function requestFocus(field: FieldName) {
    setStep(STEP_ONE_FIELDS.includes(field) ? 1 : 2);
    setFocusTarget(field);
  }

  function goToStep(next: Step) {
    setStep(next);
    setFocusTarget('step');
  }

  function validateFields(fields: readonly FieldName[]): FieldName | null {
    const next: FieldErrors = {};
    for (const field of fields) next[field] = validateField(field, values);
    setErrors((current) => ({ ...current, ...next }));
    return fields.find((field) => next[field]) ?? null;
  }

  function handleContinue() {
    const firstInvalid = validateFields(STEP_ONE_FIELDS);
    if (firstInvalid) {
      requestFocus(firstInvalid);
      return;
    }
    goToStep(2);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    if (step === 1) {
      handleContinue();
      return;
    }

    const firstInvalid = validateFields(ALL_FIELDS);
    if (firstInvalid) {
      requestFocus(firstInvalid);
      return;
    }
    if (!online) {
      offlineRef.current?.focus();
      return;
    }

    setFailure(null);
    setPending('submit');
    const result = await api.signUp({
      studentId: values.studentId,
      password: values.password,
      lastName: values.lastName.trim(),
      firstName: values.firstName.trim(),
      middleInitial: values.middleInitial,
      program: values.program as Program,
      yearLevel: Number(values.yearLevel) as YearLevel,
      block: values.block as Block,
    });
    setPending(null);

    if (result.ok) {
      navigate('/verify-email', { replace: true, state: { email: result.data.email } });
      return;
    }
    if (result.error.code === 'student_id_taken') {
      setErrors((current) => ({
        ...current,
        studentId: 'An account already exists for this Student ID. Sign in, or check the number and try again.',
      }));
      requestFocus('studentId');
      return;
    }
    setFailure(result.error.code);
  }

  const showAlerts = !online || failure === 'network';

  const createAccount = (
    <div>
      <Button
        type="submit"
        loading={pending === 'submit'}
        loadingLabel="Creating account..."
        disabled={!allValid}
        aria-describedby={allValid ? undefined : REASON_ID}
      >
        Create account
      </Button>
      {!allValid && (
        <p id={REASON_ID} className="mt-1.5 text-center text-xs text-charcoal-500">
          Fill all required fields to continue
        </p>
      )}
    </div>
  );

  const subtitle = step === 1
    ? 'Register with your student ID to access seminars.'
    : 'Provide your profile details and enrolled section.';

  return (
    <AuthLayout
      width="wide"
      footer={
        <p className="text-sm text-charcoal-700">
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="ml-1 inline-flex min-h-11 items-center font-semibold text-maroon hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <div className="mb-4 flex items-center justify-between md:mb-3">
        <Link
          to="/sign-in"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-charcoal-700 hover:text-maroon"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to sign in
        </Link>
        <p ref={stepBadgeRef} tabIndex={-1} className="rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-semibold text-maroon">
          Step {step} of 2
        </p>
      </div>

      <div className="mb-5 md:mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-charcoal-700 md:mt-1.5 md:text-base">{subtitle}</p>
      </div>

      {showAlerts && (
        <div className="mb-5 space-y-3">
          {!online && (
            <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">
              Connect to the internet to create your account. What you typed is kept.
            </Alert>
          )}
          {failure === 'network' && online && (
            <Alert variant="error" icon={TriangleAlert} title="Connection problem">
              Seminex could not be reached. Check your connection and try again.
            </Alert>
          )}
        </div>
      )}

      <div aria-label="Registration progress" className="mb-4 grid grid-cols-2 gap-3">
        {[1, 2].map((item) => {
          const active = step === item;
          const complete = step === 2 && item === 1;
          return (
            <button
              key={item}
              type="button"
              disabled={locked}
              onClick={() => item === 1 ? goToStep(1) : handleContinue()}
              aria-current={active ? 'step' : undefined}
              className={`flex min-h-[68px] items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-maroon bg-white' : 'border-charcoal-200 bg-cream-50/70 hover:border-charcoal-300'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active ? 'bg-maroon text-white' : complete ? 'bg-success text-white' : 'bg-charcoal-200 text-charcoal-700'}`}>
                {complete ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} /> : item}
              </span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-semibold uppercase tracking-wider ${active ? 'text-maroon' : 'text-charcoal-500'}`}>Step {item}</span>
                <span className="block truncate text-xs font-bold text-charcoal-900">{item === 1 ? 'Credentials' : 'Personal information'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <form noValidate onSubmit={handleSubmit} aria-busy={locked} className="space-y-5 md:space-y-6">
        {showCredentials && (
          <Section id="credentials-heading" eyebrow="Step 1 of 2" title="Login credentials">
            <StudentIdField
              ref={(element) => {
                fieldRefs.current.studentId = element;
              }}
              id="student-id"
              value={values.studentId}
              error={errors.studentId}
              readOnly={locked}
              onChange={(value) => setField('studentId', value)}
              onBlur={() => handleBlur('studentId')}
            />
            <div>
              <PasswordField
                ref={(element) => {
                  fieldRefs.current.password = element;
                }}
                id="password"
                label="Password"
                required
                autoComplete="new-password"
                value={values.password}
                error={errors.password}
                readOnly={locked}
                onChange={(value) => setField('password', value)}
                onBlur={() => handleBlur('password')}
              />
              <PasswordRules password={values.password} />
            </div>
          </Section>
        )}

        {showPersonal && (
          <Section id="personal-heading" eyebrow="Step 2 of 2" title="Personal information">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-5">
                <TextField
                  ref={(element) => {
                    fieldRefs.current.lastName = element;
                  }}
                  id="last-name"
                  label="Last name"
                  required
                  type="text"
                  autoComplete="family-name"
                  autoCapitalize="words"
                  value={values.lastName}
                  error={errors.lastName}
                  readOnly={locked}
                  onChange={(value) => setField('lastName', value)}
                  onBlur={() => handleBlur('lastName')}
                />
              </div>
              <div className="col-span-8 sm:col-span-5">
                <TextField
                  ref={(element) => {
                    fieldRefs.current.firstName = element;
                  }}
                  id="first-name"
                  label="First name"
                  required
                  type="text"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  value={values.firstName}
                  error={errors.firstName}
                  readOnly={locked}
                  onChange={(value) => setField('firstName', value)}
                  onBlur={() => handleBlur('firstName')}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <TextField
                  id="middle-initial"
                  label="M.I."
                  type="text"
                  autoComplete="additional-name"
                  value={values.middleInitial}
                  readOnly={locked}
                  onChange={(value) => setField('middleInitial', sanitizeMiddleInitial(value))}
                />
              </div>
            </div>

            <SelectField
              ref={(element) => {
                fieldRefs.current.program = element;
              }}
              id="program"
              label="Program"
              required
              placeholder="Select your program"
              options={PROGRAMS}
              value={values.program}
              error={errors.program}
              disabled={locked}
              onChange={(value) => setField('program', value)}
              onBlur={() => handleBlur('program')}
            />

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                ref={(element) => {
                  fieldRefs.current.yearLevel = element;
                }}
                id="year-level"
                label="Year level"
                required
                placeholder="Select year"
                options={YEAR_LEVELS}
                value={values.yearLevel}
                error={errors.yearLevel}
                disabled={locked}
                onChange={(value) => setField('yearLevel', value)}
                onBlur={() => handleBlur('yearLevel')}
              />
              <SelectField
                ref={(element) => {
                  fieldRefs.current.block = element;
                }}
                id="block"
                label="Block"
                required
                placeholder="Select block"
                options={BLOCKS}
                value={values.block}
                error={errors.block}
                disabled={locked}
                onChange={(value) => setField('block', value)}
                onBlur={() => handleBlur('block')}
              />
            </div>
          </Section>
        )}

        {step === 1 && (
          <div>
            <Button onClick={handleContinue}>
              <>
                Continue to step 2
                <ChevronRight aria-hidden="true" className="ml-2 inline-block h-4 w-4 align-middle" />
              </>
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {createAccount}
            <Button
              variant="secondary"
              icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
              disabled={locked}
              onClick={() => goToStep(1)}
            >
              Back to step 1
            </Button>
          </div>
        )}

        <p role="status" className="sr-only">
          {pending === 'submit' ? 'Creating account' : ''}
        </p>
      </form>
    </AuthLayout>
  );
}