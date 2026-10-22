import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AuthoredQuestion, SeminarDraft } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { getDraftReadiness } from '../readiness';

const STEPS = ['Details', 'Certificate', 'Evaluation', 'Review & Publish'] as const;
const inputClass = 'h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm text-on-surface outline-none transition-colors placeholder:text-text-subtle focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20';
const textareaClass = 'w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 py-3 font-body-sm text-body-sm text-on-surface outline-none placeholder:text-text-subtle focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20';

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function QuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: AuthoredQuestion;
  onChange: (question: AuthoredQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface-light p-space-md">
      <div className="flex items-start gap-space-sm"><textarea aria-label="Question prompt" value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} rows={2} className={`${textareaClass} flex-1`} /><button type="button" aria-label="Remove question" onClick={onRemove} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-error-container hover:text-error"><Icon name="delete" size={18} /></button></div>
      <div className="mt-space-sm flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-surface-container px-3 py-1 font-caption text-caption capitalize text-text-secondary">{question.type}</span><label className="inline-flex min-h-11 items-center gap-2 font-caption text-caption text-text-secondary"><input type="checkbox" checked={question.required} onChange={(event) => onChange({ ...question, required: event.target.checked })} />Required response</label></div>
    </article>
  );
}

export default function SeminarEditorPage() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const listing = useResource(() => api.listOrgSeminars(), `org-editor-${draftId}`);
  const source = listing.state.status === 'success' ? listing.state.data.drafts.find((item) => item.id === draftId) : undefined;
  const [draft, setDraft] = useState<SeminarDraft | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => { if (source && !draft) setDraft(source); }, [source, draft]);
  useEffect(() => { document.title = 'Create seminar - Seminex'; }, []);

  const readiness = useMemo(() => draft ? getDraftReadiness(draft) : null, [draft]);

  function updateDetails(field: keyof SeminarDraft['details'], value: string | number | undefined) {
    setDraft((current) => current ? { ...current, details: { ...current.details, [field]: value } } : current);
    setFailure(null); setMessage(null);
  }

  function updateCertificate(field: 'backgroundUrl', value: string) {
    setDraft((current) => {
      if (!current) return current;
      const old = current.certificate;
      const certificate = old ?? {
        backgroundUrl: value,
        updatedAt: new Date().toISOString(),
        nameBox: { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700 as const, align: 'center' as const, color: '#1B365D' },
      };
      return { ...current, certificate: { ...certificate, [field]: value, updatedAt: new Date().toISOString() } };
    });
  }

  function updateNameBox(field: 'fontFamily' | 'fontSize' | 'fontWeight' | 'x' | 'y' | 'width' | 'height' | 'align' | 'color', value: string | number) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { ...current.certificate.nameBox, [field]: value }, updatedAt: new Date().toISOString() } } : current);
  }

  function updateSurveyTitle(title: string) {
    setDraft((current) => current?.survey ? { ...current, survey: { ...current.survey, title } } : current);
  }

  function updateQuestion(index: number, question: AuthoredQuestion | null) {
    setDraft((current) => {
      if (!current?.survey) return current;
      const sections = current.survey.sections.map((section, sectionIndex) => sectionIndex !== 0 ? section : {
        ...section,
        questions: question ? section.questions.map((item, itemIndex) => itemIndex === index ? question : item) : section.questions.filter((_, itemIndex) => itemIndex !== index),
      });
      return { ...current, survey: { ...current.survey, version: current.survey.version + 1, sections } };
    });
  }

  function addQuestion() {
    setDraft((current) => {
      if (!current?.survey) return current;
      const sections = [...current.survey.sections];
      const first = sections[0] ?? { id: 'content', title: 'Evaluation questions', questions: [] };
      sections[0] = { ...first, questions: [...first.questions, { id: `question-${crypto.randomUUID()}`, type: 'paragraph', prompt: '', required: false, maxLength: 600, placeholder: 'Your answer' }] };
      return { ...current, survey: { ...current.survey, version: current.survey.version + 1, sections } };
    });
  }

  async function saveDraft(): Promise<SeminarDraft | null> {
    if (!draft || saving) return null;
    setSaving(true); setFailure(null); setMessage(null);
    const result = await api.saveOrgDraft(draft);
    setSaving(false);
    if (!result.ok) { setFailure('Your draft could not be saved. Check your connection and try again.'); return null; }
    setDraft(result.data); setMessage('Draft saved.');
    return result.data;
  }

  async function publish() {
    const saved = await saveDraft();
    if (!saved) return;
    if (!getDraftReadiness(saved).ready) { setFailure('Complete the details, certificate, and evaluation before publishing.'); return; }
    setSaving(true);
    const result = await api.publishOrgDraft(saved.id);
    setSaving(false);
    if (!result.ok) { setFailure('This seminar could not be published. Complete all required fields and try again.'); return; }
    navigate(`/org/my-seminars/${result.data.id}`, { replace: true });
  }

  async function onImage(event: ChangeEvent<HTMLInputElement>, target: 'cover' | 'certificate') {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFailure('Choose an image file for the seminar cover or certificate.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFailure('Choose an image smaller than 5 MB.'); return; }
    try {
      const dataUrl = await fileAsDataUrl(file);
      if (target === 'cover') updateDetails('coverImageUrl', dataUrl);
      else updateCertificate('backgroundUrl', dataUrl);
    } catch { setFailure('The image could not be read. Please choose another file.'); }
  }

  if (listing.state.status === 'loading') return <PageContainer><LoadingRegion label="Loading seminar draft"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-[34rem] rounded-xl" /></LoadingRegion></PageContainer>;
  if (listing.state.status === 'error') return <PageContainer><StateMessage role="alert" icon="info" title="Draft could not be loaded" action={<RetryButton onClick={listing.reload} />}>Check your connection and try again.</StateMessage></PageContainer>;
  if (!draft) return <PageContainer><StateMessage role="status" icon="draft" title="Draft not found" action={<Link to="/org/my-seminars" className={actionPrimary}>Back to My Seminars</Link>}>This draft may have been published or removed.</StateMessage></PageContainer>;

  const details = draft.details;
  const questions = draft.survey?.sections.flatMap((section) => section.questions) ?? [];
  const nameBox = draft.certificate?.nameBox;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary"><Link to="/org/my-seminars" className="hover:text-primary">My Seminars</Link><Icon name="chevron_right" size={16} /><span>Create seminar</span></nav><span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption text-text-secondary"><Icon name="cloud_done" size={16} />Draft editor</span></div>
        <header className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-end"><div><h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">{details.title || (draft.editingSeminarId ? 'Edit seminar' : 'Create seminar')}</h1><p className="mt-space-xs font-body-base text-body-base text-text-secondary">{details.department || 'College of Computer Studies'} · Set up the event, certificate, and evaluation form.</p></div><button type="button" onClick={async () => { const saved = await saveDraft(); if (saved) navigate('/org/my-seminars'); }} disabled={saving} className={actionTonal}><Icon name="save" size={18} />{saving ? 'Saving…' : 'Save and exit'}</button></header>

      <nav aria-label="Seminar setup steps" className="grid grid-cols-2 gap-space-sm sm:grid-cols-4">{STEPS.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`flex min-h-12 items-center gap-2 rounded-lg border px-space-sm text-left font-body-sm-medium text-body-sm-medium ${step === index ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle bg-surface-card text-text-secondary hover:bg-surface-container-low'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5">{index + 1}</span><span>{label}</span></button>)}</nav>

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}
      {message && <p role="status" className="rounded-lg bg-status-available-container p-space-md font-body-sm text-body-sm text-status-available">{message}</p>}

      <section className="rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card md:p-space-xl">
        {step === 0 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-title-lg text-title-lg text-on-surface">General information</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Required details are used in the schedule, attendee registration, and certificates.</p></div><div className="grid gap-space-md md:grid-cols-2">
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-2">Seminar title *<input required value={details.title ?? ''} onChange={(e) => updateDetails('title', e.target.value)} className={inputClass} placeholder="Enter seminar title" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-2">Seminar description *<textarea required rows={5} value={details.description ?? ''} onChange={(e) => updateDetails('description', e.target.value)} className={textareaClass} placeholder="Describe the seminar, its topics, and who should attend." /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface">Start date and time *<input type="datetime-local" value={localDateTime(details.startsAt)} onChange={(e) => updateDetails('startsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputClass} /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">End date and time *<input type="datetime-local" value={localDateTime(details.endsAt)} onChange={(e) => updateDetails('endsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputClass} /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Venue / hall *<input value={details.venue ?? ''} onChange={(e) => updateDetails('venue', e.target.value)} className={inputClass} placeholder="Room or venue" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Target capacity *<input type="number" min="1" value={details.capacity ?? ''} onChange={(e) => updateDetails('capacity', e.target.value ? Number(e.target.value) : undefined)} className={inputClass} placeholder="Number of seats" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Lead speaker name *<input value={details.speakerName ?? ''} onChange={(e) => updateDetails('speakerName', e.target.value)} className={inputClass} placeholder="Full name" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Speaker role / designation *<input value={details.speakerRole ?? ''} onChange={(e) => updateDetails('speakerRole', e.target.value)} className={inputClass} placeholder="Role or credentials" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Department *<input value={details.department ?? ''} onChange={(e) => updateDetails('department', e.target.value)} className={inputClass} placeholder="College of Computer Studies" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Required attendance (%)<input type="number" min="1" max="100" value={details.requiredAttendancePercent ?? 60} onChange={(e) => updateDetails('requiredAttendancePercent', Number(e.target.value))} className={inputClass} /></label>
          <div className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-2">Cover image<label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm text-text-secondary"><Icon name="upload_file" size={18} />Choose PNG or JPG, up to 5 MB<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onImage(e, 'cover')} className="sr-only" /></label>{details.coverImageUrl && <img src={details.coverImageUrl} alt="Seminar cover preview" className="max-h-48 rounded-lg border border-border-subtle object-cover" />}</div>
        </div></div>}

        {step === 1 && <div className="grid gap-space-lg xl:grid-cols-[1.4fr_0.6fr]"><div><div className="mb-space-md"><h2 className="font-title-lg text-title-lg text-on-surface">Digital certificate template</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Upload a background and position the dynamic student name on the 16:9 certificate canvas.</p></div><div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-container-low bg-cover bg-center" style={draft.certificate?.backgroundUrl ? { backgroundImage: `url("${draft.certificate.backgroundUrl}")` } : undefined}>{!draft.certificate && <div className="text-center"><Icon name="workspace_premium" size={32} className="mx-auto text-primary" /><p className="mt-2 font-body-sm text-body-sm text-text-secondary">Upload a certificate background to preview it.</p></div>}{draft.certificate && nameBox && <div className="absolute flex overflow-hidden" style={{ left: `${nameBox.x / 1920 * 100}%`, top: `${nameBox.y / 1080 * 100}%`, width: `${nameBox.width / 1920 * 100}%`, height: `${nameBox.height / 1080 * 100}%`, alignItems: 'center', justifyContent: nameBox.align === 'left' ? 'flex-start' : nameBox.align === 'right' ? 'flex-end' : 'center', textAlign: nameBox.align, fontFamily: nameBox.fontFamily, fontSize: `clamp(12px, ${nameBox.fontSize / 1920 * 100}vw, 36px)`, fontWeight: nameBox.fontWeight, color: nameBox.color }}>Student Full Name</div>}</div><label className="mt-space-md flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="upload_file" size={18} />{draft.certificate ? 'Replace certificate background' : 'Upload certificate background'}<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(e) => void onImage(e, 'certificate')} className="sr-only" /></label></div><div className="flex flex-col gap-space-md"><div><label className="mb-2 block font-body-sm-medium text-body-sm-medium text-on-surface">Font family</label><select disabled={!nameBox} value={nameBox?.fontFamily ?? 'Outfit'} onChange={(e) => updateNameBox('fontFamily', e.target.value)} className={inputClass}><option>Outfit</option><option>DM Sans</option><option>Georgia</option><option>Cinzel</option></select></div><div><label className="mb-2 block font-body-sm-medium text-body-sm-medium text-on-surface">Font size (px)</label><input disabled={!nameBox} type="number" min="16" max="160" value={nameBox?.fontSize ?? 72} onChange={(e) => updateNameBox('fontSize', Number(e.target.value))} className={inputClass} /></div><div className="grid grid-cols-2 gap-space-sm">{(['x','y','width','height'] as const).map((key) => <label key={key} className="flex flex-col gap-1 font-caption text-caption capitalize text-text-secondary">{key} position<input disabled={!nameBox} type="number" value={nameBox?.[key] ?? 0} onChange={(e) => updateNameBox(key, Number(e.target.value))} className={inputClass} /></label>)}</div><p className="rounded-lg bg-surface-container-low p-space-sm font-caption text-caption text-text-secondary">Coordinates use the 1920 × 1080 certificate canvas.</p></div></div>}

        {step === 2 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-title-lg text-title-lg text-on-surface">Evaluation form</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Participants receive this form after the seminar. Required answers are kept with the evaluation.</p></div><label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface">Form title<input value={draft.survey?.title ?? ''} onChange={(e) => updateSurveyTitle(e.target.value)} className={inputClass} placeholder="Seminar evaluation" /></label><div className="flex flex-col gap-space-sm">{questions.map((question, index) => <QuestionEditor key={question.id} question={question} onChange={(next) => updateQuestion(index, next)} onRemove={() => updateQuestion(index, null)} />)}</div><button type="button" onClick={addQuestion} className={`${actionTonal} w-fit`}><Icon name="add" size={18} />Add question</button><p className="rounded-lg bg-surface-container-low p-space-md font-caption text-caption text-text-secondary">Responses are associated with the seminar and displayed according to the organization’s evaluation privacy rules.</p></div>}

        {step === 3 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-title-lg text-title-lg text-on-surface">Review &amp; publish</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Finish the required setup before publishing the seminar to your organization schedule.</p></div><div className="grid gap-space-md md:grid-cols-2">{readiness?.items.map((item) => <div key={item.id} className="flex items-start gap-space-sm rounded-lg border border-border-subtle bg-surface-light p-space-md"><Icon name={item.passed ? 'check_circle' : 'error'} size={20} className={item.passed ? 'text-status-available' : 'text-status-full'} /><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{item.label}</p><p className="mt-1 font-caption text-caption text-text-secondary">{item.passed ? 'Complete' : item.reason}</p></div></div>)}</div><article className="rounded-xl border border-border-subtle bg-surface-container-low p-space-lg"><p className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">Seminar overview</p><h3 className="mt-2 font-headline-md text-headline-md text-primary">{details.title || 'Untitled seminar'}</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{details.startsAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(details.startsAt)) : 'Schedule not set'} · {details.venue || 'Venue not set'} · Capacity {details.capacity || '—'}</p><p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">{details.description || 'Add a description in the Details step.'}</p></article>{readiness?.firstBlockingReason && <p className="font-caption text-caption text-status-full">{readiness.firstBlockingReason}</p>}</div>}
      </section>

      <footer className="flex flex-col-reverse justify-between gap-space-sm sm:flex-row"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className={actionTonal}><Icon name="arrow_back" size={18} />Back</button><div className="flex flex-col-reverse gap-space-sm sm:flex-row"><button type="button" onClick={() => void saveDraft()} disabled={saving} className={actionTonal}><Icon name="save" size={18} />{saving ? 'Saving…' : 'Save draft'}</button>{step < STEPS.length - 1 ? <button type="button" onClick={async () => { const saved = await saveDraft(); if (saved) setStep((current) => Math.min(STEPS.length - 1, current + 1)); }} disabled={saving} className={actionPrimary}>Continue<Icon name="arrow_forward" size={18} /></button> : <button type="button" onClick={() => void publish()} disabled={saving || !readiness?.ready} className={actionPrimary}><Icon name="publish" size={18} />{saving ? 'Publishing…' : 'Publish seminar'}</button>}</div></footer>
    </PageContainer>
  );
}
