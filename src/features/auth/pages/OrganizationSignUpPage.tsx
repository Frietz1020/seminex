import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CircleAlert, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode, type Block, type Profile, type Program, type YearLevel } from '../../../api/client';
import { Alert } from '../../../components/ui/Alert';
import { InlineError } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { Button } from '../../../components/ui/Button';
import { BrandPanel } from '../../../components/auth/BrandPanel';
import { BrandMark } from '../../../components/shell/BrandMark';
import { PasswordField } from '../../../components/ui/PasswordField';
import { PasswordRules } from '../../../components/auth/PasswordRules';
import { StudentIdField } from '../../../components/auth/StudentIdField';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { BLOCKS, PROGRAMS, YEAR_LEVELS, programLabel, yearLevelLabel, blockLabel } from '../../../data/academic';
import { getAcademicPeriod } from '../../seminars/academicPeriod';
import { useNow } from '../../../hooks/useNow';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useSession } from '../../../session/useSession';
import { sanitizeMiddleInitial, validateNewPassword, validateRequiredName, validateSelection, validateStudentId } from '../validation';

type Step = 1 | 2 | 3;
type Values = { studentId: string; firstName: string; lastName: string; middleInitial: string; program: string; yearLevel: string; block: string; password: string; confirmPassword: string; organization: string; role: string };
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const INITIAL: Values = { studentId: '', firstName: '', lastName: '', middleInitial: '', program: '', yearLevel: '', block: '', password: '', confirmPassword: '', organization: '', role: '' };
const ROLES = [
  'President', 'Vice President', 'Secretary / Documentation Officer', 'Treasurer', 'Auditor',
  'Committee Head / Event Director', 'Public Relations Officer',
].map((label) => ({ value: label, label }));

function validate(field: Field, values: Values): string | undefined {
  switch (field) {
    case 'studentId': return validateStudentId(values.studentId);
    case 'firstName': return validateRequiredName(values.firstName, 'First name');
    case 'lastName': return validateRequiredName(values.lastName, 'Last name');
    case 'program': return validateSelection(values.program, 'Program');
    case 'yearLevel': return validateSelection(values.yearLevel, 'Year level');
    case 'block': return validateSelection(values.block, 'Block');
    case 'password': return validateNewPassword(values.password);
    case 'confirmPassword': return values.confirmPassword === values.password ? undefined : 'Passwords do not match.';
    case 'organization': return validateSelection(values.organization, 'Organization');
    case 'role': return validateSelection(values.role, 'Role');
    default: return undefined;
  }
}

export default function OrganizationSignUpPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const session = useSession();
  const applicantSession = Boolean(session && session.role !== 'adviser');
  const applicantProfile = useResource<Profile | null>(
    () => applicantSession ? api.getProfile() : Promise.resolve({ ok: true as const, data: null }),
    `org-signup-profile-${session?.studentId ?? 'none'}`,
  );
  const period = getAcademicPeriod(useNow());
  const { state: orgState, reload: reloadOrgs } = useResource(() => api.listOrganizations(), 'organizations');
  const organizations = orgState.status === 'success' ? orgState.data.map((item) => ({ value: item.id, label: item.name })) : [];
  const [step, setStep] = useState<Step>(applicantSession ? 3 : 1);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Organization sign up - Seminex'; }, []);

  useEffect(() => {
    if (!applicantSession || applicantProfile.state.status !== 'success' || !applicantProfile.state.data) return;
    const profile = applicantProfile.state.data;
    setValues((current) => ({
      ...current,
      studentId: profile.studentId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleInitial: profile.middleInitial,
      program: profile.program,
      yearLevel: String(profile.yearLevel),
      block: profile.block,
    }));
    setStep(3);
  }, [applicantSession, applicantProfile.state]);

  function setField(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (field === 'studentId' && value !== values.studentId) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpValue('');
      setOtpError('');
    }
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validate(field, next) }));
    if (field === 'password' && values.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: validate('confirmPassword', next) }));
  }

  function validateFields(fields: Field[]): boolean {
    const next: Errors = {};
    fields.forEach((field) => { next[field] = validate(field, values); });
    setErrors((current) => ({ ...current, ...next }));
    return fields.every((field) => !next[field]);
  }

  function continueStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      if (validateFields(['studentId', 'password', 'confirmPassword'])) return;
      if (!otpVerified) {
        setOtpError(otpSent ? 'Verify the OTP to continue.' : 'Send and verify an OTP to continue.');
        return;
      }
      setStep(2);
      return;
    }
    const fields: Field[] = ['firstName', 'lastName', 'program', 'yearLevel', 'block'];
    if (!validateFields(fields)) setStep(3);
  }

  function sendOtp() {
    const error = validateStudentId(values.studentId);
    if (error) {
      setErrors((current) => ({ ...current, studentId: error }));
      return;
    }
    if (!online) {
      offlineRef.current?.focus();
      return;
    }
    setOtpSent(true);
    setOtpVerified(false);
    setOtpValue('');
    setOtpError('');
  }

  function verifyOtp() {
    if (otpValue.trim() === '246810') {
      setOtpVerified(true);
      setOtpError('');
    } else {
      setOtpVerified(false);
      setOtpError('That OTP is not correct. Try the code shown here.');
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFields(['organization', 'role'])) return;
    if (!applicantSession && !otpVerified) {
      setOtpError('Verify the OTP before creating your organization request.');
      setStep(1);
      return;
    }
    if (!online) { offlineRef.current?.focus(); return; }
    setFailure(null);
    setPending(true);
    const organization = { organizationId: values.organization, position: values.role };
    if (applicantSession) {
      const request = await api.submitOrgAccessRequest({
          ...organization,
          fullName: [values.firstName.trim(), values.middleInitial && `${values.middleInitial}.`, values.lastName.trim()].filter(Boolean).join(' '),
        })
      setPending(false);
      if (request.ok) navigate('/organization/request-status', { replace: true });
      else setFailure(request.error.code);
      return;
    }
    const result = await api.orgSignUp(
      {
        studentId: values.studentId,
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        middleInitial: values.middleInitial,
        program: values.program as Program,
        yearLevel: Number(values.yearLevel) as YearLevel,
        block: values.block as Block,
      },
      organization,
    );
    setPending(false);
    if (result.ok) {
      try { window.sessionStorage.setItem('seminex.auth.returnTo', '/organization/sign-in'); } catch { /* Route state remains available in this tab. */ }
      navigate('/verify-email', { replace: true, state: { email: result.data.email, returnTo: '/organization/sign-in' } });
    }
    else if (result.error.code === 'student_id_taken') setErrors((current) => ({ ...current, studentId: 'An account already exists for this Student ID. Sign in, or check the number and try again.' }));
    else setFailure(result.error.code);
  }

  const organizationLabel = organizations.find((item) => item.value === values.organization)?.label;
  const identityName = [values.firstName, values.middleInitial && `${values.middleInitial}.`, values.lastName].filter(Boolean).join(' ');
  const personalFields: Field[] = ['firstName', 'lastName', 'program', 'yearLevel', 'block'];
  const visibleSteps: Step[] = applicantSession ? [3] : [1, 2, 3];
  const stepTitle = step === 1 ? 'Create Officer Account' : step === 2 ? 'Personal Information' : 'Your Organization';

  return (
    <div className="min-h-dvh bg-cream-50 md:flex">
      <BrandPanel
        message="Create and streamline your organization's seminars with Seminex."
        supportingText="Coordinate events, manage registrations, and support student participation in one place."
        footer={`Organization onboarding · Step ${step} of 3`}
      />

      <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8 sm:px-10 md:py-12">
        <div className="w-full max-w-[560px]">
          <header className="mb-6 flex items-center justify-between">
            <Link to="/organization/sign-in" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
            <span className="rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold text-maroon">Step {step} of 3</span>
          </header>
          <div className="mb-6 flex items-center gap-3 md:hidden"><BrandMark size={40} /><span><p className="font-heading text-xl font-bold text-charcoal-900">Seminex</p><p className="text-xs uppercase tracking-wide text-burnt">CCS Gordon College</p></span></div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">{stepTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-700">Create and streamline your organization's seminars, coordinate events, and support student participation with Seminex.</p>

          {!applicantSession && (
          <div className="my-5 grid grid-cols-3 gap-3" aria-label="Registration progress">
            {visibleSteps.map((item) => <button key={item} type="button" onClick={() => {
              if (item === 1) setStep(1);
              else if (item === 2 && otpVerified) setStep(2);
              else if (item === 3 && (applicantSession || (otpVerified && !validateFields(personalFields)))) setStep(3);
            }} aria-current={step === item ? 'step' : undefined} className={`flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left ${step === item ? 'border-maroon bg-white' : 'border-charcoal-200 bg-white/60'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${step > item ? 'bg-success text-white' : step === item ? 'bg-maroon text-white' : 'bg-charcoal-200 text-charcoal-700'}`}>{step > item ? <Check className="h-4 w-4" /> : item}</span><span><span className="block text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">Step {item}</span><span className="block text-xs font-bold text-charcoal-900">{item === 1 ? 'Credentials + OTP' : item === 2 ? 'Personal Information' : 'Your Organization'}</span></span></button>)}
          </div>
          )}

          {!online && <div className="mb-4"><Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">Connect to the internet to create your account. Your entries are kept.</Alert></div>}
          {failure === 'network' && online && <div className="mb-4"><Alert variant="error" icon={TriangleAlert} title="Connection problem">Seminex could not be reached. Check your connection and try again.</Alert></div>}

          {applicantSession && (applicantProfile.state.status === 'loading' || (applicantProfile.state.status === 'success' && !applicantProfile.state.data)) ? (
            <p role="status" className="rounded-xl bg-white p-5 text-sm text-charcoal-700 shadow-control">Loading your applicant profile…</p>
          ) : applicantSession && applicantProfile.state.status === 'error' ? (
            <InlineError onRetry={applicantProfile.reload}>Your applicant profile could not be loaded.</InlineError>
          ) : step === 1 ? (
            <form noValidate onSubmit={continueStep} className="space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
              <section className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-burnt">Step 1 of 3</p><h3 className="font-heading text-lg font-bold text-charcoal-900">Credentials and OTP</h3></div>
                <StudentIdField id="org-signup-student-id" value={values.studentId} error={errors.studentId} onChange={(value) => setField('studentId', value)} onBlur={() => setErrors((current) => ({ ...current, studentId: validate('studentId', values) }))} />
                {!validateStudentId(values.studentId) && <Button variant="secondary" onClick={sendOtp}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Button>}
                {otpSent && (
                  <div className="space-y-3 rounded-xl bg-cream-50 p-4">
                    <p className="text-sm text-charcoal-700">Enter the OTP for your student account. Local demo code: <strong>246810</strong>.</p>
                    <TextField id="org-signup-otp" label="One-time password" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit OTP" value={otpValue} onChange={setOtpValue} />
                    <Button variant="secondary" onClick={verifyOtp} disabled={otpVerified}>{otpVerified ? 'OTP verified' : 'Verify OTP'}</Button>
                  </div>
                )}
                <div><PasswordField id="org-signup-password" label="Account password" required autoComplete="new-password" value={values.password} error={errors.password} onChange={(value) => setField('password', value)} onBlur={() => setErrors((current) => ({ ...current, password: validate('password', values) }))} /><PasswordRules password={values.password} /></div>
                <div><PasswordField id="org-signup-confirm" label="Confirm password" required autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} onChange={(value) => setField('confirmPassword', value)} onBlur={() => setErrors((current) => ({ ...current, confirmPassword: validate('confirmPassword', values) }))} /></div>
              </section>
              {!otpVerified && otpError && <p role="alert" className="text-sm font-medium text-danger-ink">{otpError}</p>}
              <Button type="submit" icon={<ArrowRight className="h-4 w-4" />}>Continue to personal information</Button>
            </form>
          ) : step === 2 ? (
            <form noValidate onSubmit={continueStep} className="space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
              <section className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-burnt">Step 2 of 3</p><h3 className="font-heading text-lg font-bold text-charcoal-900">Personal information</h3></div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-5"><TextField id="org-signup-last-name" label="Last name" required autoComplete="family-name" value={values.lastName} error={errors.lastName} onChange={(value) => setField('lastName', value)} onBlur={() => setErrors((current) => ({ ...current, lastName: validate('lastName', values) }))} /></div>
                  <div className="col-span-8 sm:col-span-5"><TextField id="org-signup-first-name" label="First name" required autoComplete="given-name" value={values.firstName} error={errors.firstName} onChange={(value) => setField('firstName', value)} onBlur={() => setErrors((current) => ({ ...current, firstName: validate('firstName', values) }))} /></div>
                  <div className="col-span-4 sm:col-span-2"><TextField id="org-signup-mi" label="M.I." autoComplete="additional-name" value={values.middleInitial} onChange={(value) => setField('middleInitial', sanitizeMiddleInitial(value))} /></div>
                </div>
                <SelectField id="org-signup-program" label="Academic program" required placeholder="Select CCS degree program" options={PROGRAMS} value={values.program} error={errors.program} onChange={(value) => setField('program', value)} onBlur={() => setErrors((current) => ({ ...current, program: validate('program', values) }))} />
                <div className="grid grid-cols-2 gap-3"><SelectField id="org-signup-year" label="Year level" required placeholder="Select year" options={YEAR_LEVELS} value={values.yearLevel} error={errors.yearLevel} onChange={(value) => setField('yearLevel', value)} onBlur={() => setErrors((current) => ({ ...current, yearLevel: validate('yearLevel', values) }))} /><SelectField id="org-signup-block" label="Assigned block" required placeholder="Select block" options={BLOCKS} value={values.block} error={errors.block} onChange={(value) => setField('block', value)} onBlur={() => setErrors((current) => ({ ...current, block: validate('block', values) }))} /></div>
              </section>
              <Button type="submit" icon={<ArrowRight className="h-4 w-4" />}>Continue to your organization</Button>
              <Button variant="secondary" onClick={() => setStep(1)} icon={<ArrowLeft className="h-4 w-4" />}>Back to credentials</Button>
            </form>
          ) : (
            <form noValidate onSubmit={submitRequest} className="space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-burnt">Step 3 of 3</p><h3 className="font-heading text-lg font-bold text-charcoal-900">Your Organization</h3><p className="mt-1 text-sm text-charcoal-700">Choose the organization and appointed role you represent.</p></div>
              <div className="rounded-xl bg-cream-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Account identity</p><p className="mt-1 font-semibold text-charcoal-900">{identityName || 'Your name'} · {values.studentId || 'Student ID'}</p><p className="mt-1 text-sm text-charcoal-600">{values.program ? programLabel(values.program as Program) : 'Program'} · {values.yearLevel ? yearLevelLabel(Number(values.yearLevel) as YearLevel) : 'Year level'} · {values.block ? blockLabel(values.block as Block) : 'Block'}</p></div>
              {orgState.status === 'error' && <InlineError onRetry={reloadOrgs}>Organizations could not be loaded.</InlineError>}
              <SelectField id="org-signup-organization" label="Student organization" required placeholder={orgState.status === 'loading' ? 'Loading organizations' : 'Select your organization'} disabled={orgState.status !== 'success'} options={organizations} value={values.organization} error={errors.organization} onChange={(value) => setField('organization', value)} />
              <SelectField id="org-signup-role" label="Constitutional role" required placeholder="Select your official role" options={ROLES} value={values.role} error={errors.role} onChange={(value) => setField('role', value)} />
              <div><label className="mb-2 block text-sm font-semibold text-charcoal-900">Term / Academic Year</label><div className="rounded-control border border-charcoal-200 bg-cream-50 px-3.5 py-3 text-sm text-charcoal-700">Academic Year {period.academicYear}</div></div>
              <div className="rounded-xl border border-charcoal-300 bg-white p-4 text-sm leading-relaxed text-charcoal-900"><strong className="block">Adviser approval</strong>Your adviser reviews your request. Until it is approved, you can use the participant portal only.</div>
              <div className="rounded-xl bg-cream-100 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Request summary</p><div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-charcoal-600">Selected organization</span><strong className="text-right text-charcoal-900">{organizationLabel || 'Not selected'}</strong></div><div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-charcoal-600">Appointed role</span><strong className="text-right text-maroon">{values.role || 'Not selected'}</strong></div></div>
              <Button type="submit" loading={pending} loadingLabel="Creating request...">{applicantSession ? 'Send organization access request' : 'Create account and send request'}</Button>
              {!applicantSession && <Button variant="secondary" disabled={pending} icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(2)}>Back to personal information</Button>}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-charcoal-600"><CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />By continuing, you confirm that your organization and role are correct.</p>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-charcoal-700">Already have an account? <Link to="/organization/sign-in" className="font-semibold text-maroon hover:underline">Sign in</Link></p>
          <p className="mt-5 text-center text-xs text-charcoal-500">Gordon College Olongapo · CCS Gordon College</p>
        </div>
      </main>
    </div>
  );
}
