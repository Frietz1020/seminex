import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CircleAlert, ShieldCheck, TriangleAlert, WifiOff } from 'lucide-react';
import { api, type ApiErrorCode, type Block, type Program, type YearLevel } from '../../../api/client';
import { Alert } from '../../../components/ui/Alert';
import { InlineError } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { Button } from '../../../components/ui/Button';
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
import { sanitizeMiddleInitial, validateNewPassword, validateRequiredName, validateSelection, validateStudentId } from '../validation';

type Step = 1 | 2;
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
  const period = getAcademicPeriod(useNow());
  const { state: orgState, reload: reloadOrgs } = useResource(() => api.listOrganizations(), 'organizations');
  const organizations = orgState.status === 'success' ? orgState.data.map((item) => ({ value: item.id, label: item.name })) : [];
  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Organization sign up - Seminex'; }, []);

  function setField(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
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
    const fields: Field[] = ['studentId', 'firstName', 'lastName', 'program', 'yearLevel', 'block', 'password', 'confirmPassword'];
    if (validateFields(fields)) setStep(2);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFields(['organization', 'role'])) return;
    if (!online) { offlineRef.current?.focus(); return; }
    setFailure(null);
    setPending(true);
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
      { organizationId: values.organization, position: values.role },
    );
    setPending(false);
    if (result.ok) navigate('/verify-email', { replace: true, state: { email: result.data.email, returnTo: '/organization/sign-in' } });
    else if (result.error.code === 'student_id_taken') setErrors((current) => ({ ...current, studentId: 'An account already exists for this Student ID. Sign in, or check the number and try again.' }));
    else setFailure(result.error.code);
  }

  const organizationLabel = organizations.find((item) => item.value === values.organization)?.label;
  const identityName = [values.firstName, values.middleInitial && `${values.middleInitial}.`, values.lastName].filter(Boolean).join(' ');
  const personalFields: Field[] = ['studentId', 'firstName', 'lastName', 'program', 'yearLevel', 'block', 'password', 'confirmPassword'];

  return (
    <div className="min-h-dvh bg-cream-50 md:flex">
      <aside className="relative hidden min-h-dvh w-[42%] flex-col justify-between overflow-hidden bg-maroon p-10 text-white md:flex lg:w-[40%] lg:p-16">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3"><BrandMark size={48} variant="onDark" /><span><strong className="block font-heading text-2xl">Seminex</strong><small className="uppercase tracking-widest text-cream-200">CCS Gordon College</small></span></div>
        <div className="relative z-10 my-auto max-w-md py-12">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cream-200">Organization onboarding</span>
          <h1 className="mt-5 font-heading text-3xl font-bold leading-tight lg:text-4xl">Empower your student organization with Seminex.</h1>
          <p className="mt-4 leading-relaxed text-cream-100/85">Register your institutional identity, then provide the organization and official role you represent.</p>
          <div className="mt-8 space-y-3">
            {[['1', 'Create officer account'], ['2', 'Your organization']].map(([number, title], index) => <div key={number} className={`flex items-center gap-3 rounded-xl border p-4 ${step === index + 1 ? 'border-white bg-white text-maroon' : 'border-white/20 bg-white/10 text-white'}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-maroon/10 font-bold">{step > index + 1 ? <Check className="h-4 w-4" /> : number}</span><span className="text-sm font-semibold">Step {number} · {title}</span></div>)}
          </div>
        </div>
        <p className="relative z-10 text-xs text-cream-200/80">College of Computer Studies Student Council</p>
      </aside>

      <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8 sm:px-10 md:py-12">
        <div className="w-full max-w-[560px]">
          <header className="mb-6 flex items-center justify-between">
            <Link to="/organization/sign-in" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
            <span className="rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold text-maroon">Step {step} of 2</span>
          </header>
          <div className="mb-6 flex items-center gap-3 md:hidden"><BrandMark size={40} /><span><p className="font-heading text-xl font-bold text-charcoal-900">Seminex</p><p className="text-xs uppercase tracking-wide text-burnt">CCS Gordon College</p></span></div>
          <div className="mb-5 flex items-center gap-2 rounded-md bg-cream-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-maroon"><ShieldCheck className="h-4 w-4" />Seminex · CCS Gordon College</div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">{step === 1 ? 'Create Officer Account' : 'Your Organization Details'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-700">{step === 1 ? 'Step 1 of 2: Enter your institutional credentials and academic record.' : 'Step 2 of 2: Select your student organization and official council role.'}</p>

          <div className="my-5 grid grid-cols-2 gap-3" aria-label="Registration progress">
            {[1, 2].map((item) => <button key={item} type="button" onClick={() => item === 1 ? setStep(1) : validateFields(personalFields) && setStep(2)} aria-current={step === item ? 'step' : undefined} className={`flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left ${step === item ? 'border-maroon bg-white' : 'border-charcoal-200 bg-white/60'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${step === item ? 'bg-maroon text-white' : step > item ? 'bg-success text-white' : 'bg-charcoal-200 text-charcoal-700'}`}>{step > item ? <Check className="h-4 w-4" /> : item}</span><span><span className="block text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">Step {item}</span><span className="block text-xs font-bold text-charcoal-900">{item === 1 ? 'Credentials' : 'Your Organization'}</span></span></button>)}
          </div>

          {!online && <div className="mb-4"><Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">Connect to the internet to create your account. Your entries are kept.</Alert></div>}
          {failure === 'network' && online && <div className="mb-4"><Alert variant="error" icon={TriangleAlert} title="Connection problem">Seminex could not be reached. Check your connection and try again.</Alert></div>}

          {step === 1 ? (
            <form noValidate onSubmit={continueStep} className="space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
              <section className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-burnt">Step 1 of 2</p><h3 className="font-heading text-lg font-bold text-charcoal-900">Institutional credentials</h3></div>
                <StudentIdField id="org-signup-student-id" value={values.studentId} error={errors.studentId} onChange={(value) => setField('studentId', value)} onBlur={() => setErrors((current) => ({ ...current, studentId: validate('studentId', values) }))} />
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-5"><TextField id="org-signup-last-name" label="Last name" required autoComplete="family-name" value={values.lastName} error={errors.lastName} onChange={(value) => setField('lastName', value)} onBlur={() => setErrors((current) => ({ ...current, lastName: validate('lastName', values) }))} /></div>
                  <div className="col-span-8 sm:col-span-5"><TextField id="org-signup-first-name" label="First name" required autoComplete="given-name" value={values.firstName} error={errors.firstName} onChange={(value) => setField('firstName', value)} onBlur={() => setErrors((current) => ({ ...current, firstName: validate('firstName', values) }))} /></div>
                  <div className="col-span-4 sm:col-span-2"><TextField id="org-signup-mi" label="M.I." autoComplete="additional-name" value={values.middleInitial} onChange={(value) => setField('middleInitial', sanitizeMiddleInitial(value))} /></div>
                </div>
                <SelectField id="org-signup-program" label="Academic program" required placeholder="Select CCS degree program" options={PROGRAMS} value={values.program} error={errors.program} onChange={(value) => setField('program', value)} onBlur={() => setErrors((current) => ({ ...current, program: validate('program', values) }))} />
                <div className="grid grid-cols-2 gap-3"><SelectField id="org-signup-year" label="Year level" required placeholder="Select year" options={YEAR_LEVELS} value={values.yearLevel} error={errors.yearLevel} onChange={(value) => setField('yearLevel', value)} onBlur={() => setErrors((current) => ({ ...current, yearLevel: validate('yearLevel', values) }))} /><SelectField id="org-signup-block" label="Assigned block" required placeholder="Select block" options={BLOCKS} value={values.block} error={errors.block} onChange={(value) => setField('block', value)} onBlur={() => setErrors((current) => ({ ...current, block: validate('block', values) }))} /></div>
                <div><PasswordField id="org-signup-password" label="Account password" required autoComplete="new-password" value={values.password} error={errors.password} onChange={(value) => setField('password', value)} onBlur={() => setErrors((current) => ({ ...current, password: validate('password', values) }))} /><PasswordRules password={values.password} /></div>
                <div><PasswordField id="org-signup-confirm" label="Confirm password" required autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} onChange={(value) => setField('confirmPassword', value)} onBlur={() => setErrors((current) => ({ ...current, confirmPassword: validate('confirmPassword', values) }))} /></div>
              </section>
              <Button type="submit" icon={<ArrowRight className="h-4 w-4" />}>Continue to organization details</Button>
            </form>
          ) : (
            <form noValidate onSubmit={submitRequest} className="space-y-5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-control md:p-6">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-burnt">Step 2 of 2</p><h3 className="font-heading text-lg font-bold text-charcoal-900">Your Organization Details</h3><p className="mt-1 text-sm text-charcoal-700">Choose the organization and appointed role you represent.</p></div>
              <div className="rounded-xl bg-cream-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Account identity</p><p className="mt-1 font-semibold text-charcoal-900">{identityName || 'Your name'} · {values.studentId || 'Student ID'}</p><p className="mt-1 text-sm text-charcoal-600">{programLabel(values.program as Program)} · {yearLevelLabel(Number(values.yearLevel) as YearLevel)} · {blockLabel(values.block as Block)}</p></div>
              {orgState.status === 'error' && <InlineError onRetry={reloadOrgs}>Organizations could not be loaded.</InlineError>}
              <SelectField id="org-signup-organization" label="Student organization" required placeholder={orgState.status === 'loading' ? 'Loading organizations' : 'Select your organization'} disabled={orgState.status !== 'success'} options={organizations} value={values.organization} error={errors.organization} onChange={(value) => setField('organization', value)} />
              <SelectField id="org-signup-role" label="Constitutional role" required placeholder="Select your official role" options={ROLES} value={values.role} error={errors.role} onChange={(value) => setField('role', value)} />
              <div><label className="mb-2 block text-sm font-semibold text-charcoal-900">Term / Academic Year</label><div className="rounded-control border border-charcoal-200 bg-cream-50 px-3.5 py-3 text-sm text-charcoal-700">Academic Year {period.academicYear}</div></div>
              <div className="rounded-xl border border-charcoal-300 bg-white p-4 text-sm leading-relaxed text-charcoal-900"><strong className="block">Adviser approval</strong>Your adviser reviews your request. Until it is approved, you can use the participant portal only.</div>
              <div className="rounded-xl bg-cream-100 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">Request summary</p><div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-charcoal-600">Selected organization</span><strong className="text-right text-charcoal-900">{organizationLabel || 'Not selected'}</strong></div><div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-charcoal-600">Appointed role</span><strong className="text-right text-maroon">{values.role || 'Not selected'}</strong></div></div>
              <Button type="submit" loading={pending} loadingLabel="Creating account...">Create account and send request</Button>
              <Button variant="secondary" disabled={pending} icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(1)}>Back to step 1</Button>
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