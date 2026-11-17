import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AuthoredQuestion, SeminarDraft, SurveyOption } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { Icon } from '../../../components/ui/Icon';
import { CertificateDesigner } from '../components/CertificateDesigner';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { getDraftReadiness } from '../readiness';
import { sanitizeRichText } from '../../evaluation/richText';
import { legacyCoverDataUrlToFile } from '../coverImage';

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

function seminarCoverObjectPath(publicUrl: string | undefined, draftId: string): string | null {
  if (!publicUrl) return null;
  try {
    const pathname = new URL(publicUrl).pathname;
    const marker = '/storage/v1/object/public/seminar-covers/';
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(pathname.slice(markerIndex + marker.length));
    const segments = path.split('/');
    if (segments.length !== 3 || segments[1] !== draftId) return null;
    return path;
  } catch {
    return null;
  }
}

function QuestionEditor({
  question,
  onChange,
  onRemove,
  onDuplicate,
  onActivate,
}: {
  question: AuthoredQuestion;
  onChange: (question: AuthoredQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onActivate: () => void;
}) {
  const options = 'options' in question ? question.options : null;
  const promptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (promptRef.current) promptRef.current.innerHTML = sanitizeRichText(question.prompt);
  }, [question.id]);
  function onPromptInput() {
    if (promptRef.current) onChange({ ...question, prompt: sanitizeRichText(promptRef.current.innerHTML) });
  }
  function onPromptPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  }
  return (
    <article onPointerDown={onActivate} onFocusCapture={onActivate} className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-sm transition-shadow focus-within:shadow-card">
      <div className="h-1.5 bg-primary" />
      <div className="flex flex-col gap-space-md p-space-lg">
        <div className="flex flex-col gap-space-sm sm:flex-row sm:items-start">
          <div ref={promptRef} data-prompt-editor={question.id} role="textbox" aria-label="Question prompt" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={onPromptInput} onPaste={onPromptPaste} data-placeholder="Question" className="min-h-12 min-w-0 flex-1 border-b-2 border-border-subtle bg-surface-container-low px-3 py-3 font-body-base text-body-base text-on-surface outline-none transition-colors focus:border-primary empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-text-subtle" />
          <select aria-label="Question type" value={question.type} onChange={(event) => onChange(createQuestionType(question, event.target.value as QuestionKind))} className="h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3 font-body-sm text-body-sm text-on-surface sm:w-52">
            <option value="paragraph">Paragraph</option><option value="choice">Multiple choice</option><option value="checkbox">Checkboxes</option><option value="scale">Linear scale</option><option value="rating">Rating</option>
          </select>
        </div>
        {question.type === 'paragraph' && <div className="max-w-lg border-b border-dashed border-border-subtle pb-2 font-body-sm text-text-subtle">Long answer text</div>}
        {(question.type === 'choice' || question.type === 'checkbox') && options && <div className="flex flex-col gap-2">{options.map((option, optionIndex) => <div key={`${option.value}-${optionIndex}`} className="flex items-center gap-2"><span className={`flex h-5 w-5 shrink-0 items-center justify-center border border-outline-variant ${question.type === 'choice' ? 'rounded-full' : 'rounded-sm'}`} /><input aria-label={`Option ${optionIndex + 1}`} value={option.label} onChange={(event) => onChange({ ...question, options: question.options.map((item, index) => index === optionIndex ? { ...item, label: event.target.value, value: optionValue(event.target.value, index) } : item) })} className="h-9 min-w-0 flex-1 border-b border-transparent bg-transparent font-body-sm text-body-sm text-on-surface outline-none focus:border-primary" placeholder={`Option ${optionIndex + 1}`} /><button type="button" aria-label={`Remove option ${optionIndex + 1}`} disabled={options.length <= 1} onClick={() => onChange({ ...question, options: question.options.filter((_, index) => index !== optionIndex) })} className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle hover:bg-surface-container disabled:opacity-30"><Icon name="close" size={16}/></button></div>)}<button type="button" onClick={() => onChange({ ...question, options: [...question.options, { value: `option-${question.options.length + 1}`, label: `Option ${question.options.length + 1}` }] })} className="w-fit font-body-sm text-primary hover:underline">Add option</button></div>}
        {question.type === 'scale' && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-space-sm"><span className="font-caption text-caption text-text-secondary">{question.min}</span><div className="flex gap-2">{Array.from({ length: Math.min(question.max - question.min + 1, 7) }, (_, index) => <span key={index} className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-card font-caption text-caption">{question.min + index}</span>)}</div><span className="font-caption text-caption text-text-secondary">{question.max}</span><label className="ml-auto flex items-center gap-2 font-caption text-caption text-text-secondary">Scale to<input type="number" min={2} max={10} value={question.max} onChange={(event) => onChange({ ...question, max: Math.max(question.min + 1, Number(event.target.value)) })} className="h-9 w-16 rounded-md border border-border-subtle bg-surface-card px-2"/></label></div>}
        {question.type === 'rating' && <div className="flex items-center gap-2 text-secondary"><Icon name="star" size={22}/><Icon name="star" size={22}/><Icon name="star" size={22}/><Icon name="star" size={22}/><Icon name="star" size={22}/><label className="ml-auto flex items-center gap-2 font-caption text-caption text-text-secondary">Max rating<input type="number" min={2} max={10} value={question.max} onChange={(event) => onChange({ ...question, max: Math.max(2, Number(event.target.value)), descriptors: question.descriptors.slice(0, Math.max(2, Number(event.target.value))) })} className="h-9 w-16 rounded-md border border-border-subtle bg-surface-card px-2"/></label></div>}
        <div className="flex flex-wrap items-center justify-end gap-space-sm border-t border-border-subtle pt-space-sm"><button type="button" onClick={onDuplicate} title="Duplicate question" aria-label="Duplicate question" className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-container"><Icon name="draft" size={18}/></button><button type="button" onClick={onRemove} title="Delete question" aria-label="Delete question" className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-error-container hover:text-error"><Icon name="delete" size={18}/></button><span className="mx-1 h-7 border-l border-border-subtle"/><label className="inline-flex min-h-9 items-center gap-2 font-body-sm text-body-sm text-text-secondary"><input type="checkbox" checked={question.required} onChange={(event) => onChange({ ...question, required: event.target.checked })} className="accent-primary"/>Required</label></div>
      </div>
    </article>
  );
}

type QuestionKind = AuthoredQuestion['type'];
function optionValue(label: string, index: number) { return `${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'option'}-${index + 1}`; }
function createQuestionType(question: AuthoredQuestion, type: QuestionKind): AuthoredQuestion {
  const base = { id: question.id, prompt: question.prompt, help: question.help, required: question.required };
  if (type === 'paragraph') return { ...base, type, maxLength: 600, placeholder: 'Your answer' };
  if (type === 'scale') return { ...base, type, min: 1, max: 5, startLabel: 'Not satisfied', endLabel: 'Very satisfied' };
  if (type === 'rating') return { ...base, type, max: 5, descriptors: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] };
  const options: SurveyOption[] = 'options' in question ? question.options : [{ value: 'option-1', label: 'Option 1' }, { value: 'option-2', label: 'Option 2' }];
  return { ...base, type, columns: 1, options };
}

export default function SeminarEditorPage() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const listing = useResource(() => api.listOrgSeminars({ seminars: { pageSize: 1 }, drafts: { pageSize: 999 } }), `org-editor-${draftId}`);
  const source = listing.state.status === 'success' ? listing.state.data.drafts.items.find((item) => item.id === draftId) : undefined;
  const [draft, setDraft] = useState<SeminarDraft | null>(null);
  const [step, setStep] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const savedCoverUrl = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (source && !draft) {
      savedCoverUrl.current = source.details.coverImageUrl;
      setDraft(source);
    }
  }, [source, draft]);
  useEffect(() => { document.title = 'Create seminar - Seminex'; }, []);

  const activeCount = listing.state.status === 'success' && draft?.editingSeminarId
    ? listing.state.data.seminars.items.find((item) => item.id === draft.editingSeminarId)?.registeredCount ?? 0
    : 0;
  const readiness = useMemo(() => draft ? getDraftReadiness(draft, activeCount) : null, [draft, activeCount]);

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
        canvasWidth: 1920,
        canvasHeight: 1080,
        updatedAt: new Date().toISOString(),
        nameBox: { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700 as const, align: 'center' as const, color: '#1B365D' },
      };
      return { ...current, certificate: { ...certificate, [field]: value, updatedAt: new Date().toISOString() } };
    });
  }

  function updateCanvasSize(field: 'canvasWidth' | 'canvasHeight', value: number) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, [field]: Math.max(1, Math.min(20000, value)), updatedAt: new Date().toISOString() } } : current);
  }

  function updateNameBox(field: 'fontFamily' | 'fontSize' | 'fontWeight' | 'x' | 'y' | 'width' | 'height' | 'align' | 'color' | 'lineHeight', value: string | number) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { ...current.certificate.nameBox, [field]: value }, updatedAt: new Date().toISOString() } } : current);
  }

  function updateNameBoxGeometry(value: Pick<NonNullable<SeminarDraft['certificate']>['nameBox'], 'x' | 'y' | 'width' | 'height'>) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { ...current.certificate.nameBox, ...value }, updatedAt: new Date().toISOString() } } : current);
  }

  async function onSignatureImage(event: ChangeEvent<HTMLInputElement>, signatureId?: string) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setFailure('Choose a PNG, JPG, or WebP signature image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFailure('Choose a signature image smaller than 5 MB.'); return; }
    try {
      const imageUrl = await fileAsDataUrl(file);
      setDraft((current) => {
        if (!current?.certificate) return current;
        const legacy = current.certificate.signatureBox ? [{ id: 'legacy-signature', imageName: 'Signature', ...current.certificate.signatureBox }] : [];
        const boxes = current.certificate.signatureBoxes ?? legacy;
        const next = signatureId
          ? boxes.map((box) => box.id === signatureId ? { ...box, imageUrl, imageName: file.name } : box)
          : [...boxes, { id: crypto.randomUUID(), imageName: file.name, imageUrl, x: 1320 + boxes.length * 32, y: 850 + boxes.length * 24, width: 400, height: 120 }];
        return { ...current, certificate: { ...current.certificate, signatureBox: undefined, signatureBoxes: next, updatedAt: new Date().toISOString() } };
      });
      setFailure(null); setMessage(null);
    } catch { setFailure('The signature image could not be read. Please choose another file.'); }
  }

  function removeSignatureBox(signatureId: string) {
    setDraft((current) => {
      if (!current?.certificate) return current;
      const boxes = current.certificate.signatureBoxes ?? (current.certificate.signatureBox ? [{ id: 'legacy-signature', imageName: 'Signature', ...current.certificate.signatureBox }] : []);
      return { ...current, certificate: { ...current.certificate, signatureBox: undefined, signatureBoxes: boxes.filter((box) => box.id !== signatureId), updatedAt: new Date().toISOString() } };
    });
  }

  function updateSignatureGeometry(signatureId: string, value: Pick<NonNullable<SeminarDraft['certificate']>['nameBox'], 'x' | 'y' | 'width' | 'height'>) {
    setDraft((current) => {
      if (!current?.certificate) return current;
      const boxes = current.certificate.signatureBoxes ?? (current.certificate.signatureBox ? [{ id: 'legacy-signature', imageName: 'Signature', ...current.certificate.signatureBox }] : []);
      return { ...current, certificate: { ...current.certificate, signatureBox: undefined, signatureBoxes: boxes.map((box) => box.id === signatureId ? { ...box, ...value } : box), updatedAt: new Date().toISOString() } };
    });
  }

  function updateQrCodeGeometry(value: Pick<NonNullable<SeminarDraft['certificate']>['nameBox'], 'x' | 'y' | 'width' | 'height'>) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, qrCodeBox: value, updatedAt: new Date().toISOString() } } : current);
  }

  function resetNameBox() {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, lineHeight: 90, fontWeight: 700, align: 'center', color: '#1B365D' }, updatedAt: new Date().toISOString() } } : current);
  }

  function updateSurveyTitle(title: string) {
    setDraft((current) => current?.survey ? { ...current, survey: { ...current.survey, title } } : current);
  }

  function updateSurveyInstructions(instructions: string) {
    setDraft((current) => current?.survey ? { ...current, survey: { ...current.survey, instructions } } : current);
  }

  function duplicateQuestion(index: number) {
    setDraft((current) => {
      if (!current?.survey) return current;
      let offset = 0;
      let inserted = false;
      const sections = current.survey.sections.map((section) => {
        if (inserted || index < offset || index >= offset + section.questions.length) {
          offset += section.questions.length;
          return section;
        }
        const position = index - offset;
        const original = section.questions[position];
        if (!original) return section;
        const clone = { ...original, id: `question-${crypto.randomUUID()}` } as AuthoredQuestion;
        const nextQuestions = [...section.questions];
        nextQuestions.splice(position + 1, 0, clone);
        inserted = true;
        offset += section.questions.length;
        return { ...section, questions: nextQuestions };
      });
      if (!inserted) return current;
      return { ...current, survey: { ...current.survey, version: current.survey.version + 1, sections } };
    });
  }

  function updateQuestion(index: number, question: AuthoredQuestion | null) {
    setDraft((current) => {
      if (!current?.survey) return current;
      let questionIndex = 0;
      const sections = current.survey.sections.map((section) => ({
        ...section,
        questions: section.questions.flatMap((item) => {
          const matches = questionIndex === index;
          questionIndex += 1;
          return matches ? (question ? [question] : []) : [item];
        }),
      }));
      return { ...current, survey: { ...current.survey, version: current.survey.version + 1, sections } };
    });
  }

  function addQuestion() {
    const newQuestionId = `question-${crypto.randomUUID()}`;
    setDraft((current) => {
      if (!current?.survey) return current;
      const sections = [...current.survey.sections];
      const first = sections[0] ?? { id: 'content', title: 'Evaluation questions', questions: [] };
      sections[0] = { ...first, questions: [...first.questions, { id: newQuestionId, type: 'paragraph', prompt: '', required: false, maxLength: 600, placeholder: 'Your answer' }] };
      return { ...current, survey: { ...current.survey, version: current.survey.version + 1, sections } };
    });
    setActiveQuestionId(newQuestionId);
  }

  async function saveDraft(): Promise<SeminarDraft | null> {
    if (!draft || saving) return null;
    setSaving(true); setFailure(null); setMessage(null);
    let draftToSave = draft;
    let uploadedCover: { publicUrl: string; objectPath: string } | null = null;
    if (draft.details.coverImageUrl?.startsWith('data:')) {
      let file: File;
      try {
        file = legacyCoverDataUrlToFile(draft.details.coverImageUrl);
      } catch {
        setSaving(false);
        setFailure('Choose a valid PNG, JPG, or WebP cover image no larger than 5 MiB.');
        return null;
      }
      const upload = await api.uploadOrgSeminarCover(draft.id, file);
      if (!upload.ok) {
        setSaving(false);
        setFailure('The cover could not be uploaded. Check your connection and try again.');
        return null;
      }
      uploadedCover = upload.data;
      draftToSave = { ...draft, details: { ...draft.details, coverImageUrl: uploadedCover.publicUrl } };
    }

    const result = await api.saveOrgDraft(draftToSave);
    if (!result.ok) {
      const saveStatusUnknown = result.error.code === 'network';
      let cleanupFailed = false;
      if (uploadedCover && !saveStatusUnknown) {
        try {
          const cleanup = await api.removeOrgSeminarCover(draft.id, uploadedCover.objectPath);
          cleanupFailed = !cleanup.ok;
        } catch {
          cleanupFailed = true;
        }
      }
      setSaving(false);
      setFailure(saveStatusUnknown
        ? 'We could not confirm whether the draft was saved. The new cover may already be linked and is public; reload the draft before retrying.'
        : cleanupFailed
          ? 'Your draft could not be saved. The new public cover could not be removed; try saving again or contact support.'
          : 'Your draft could not be saved. Check your connection and try again.');
      return null;
    }

    const previousCoverPath = uploadedCover
      ? seminarCoverObjectPath(savedCoverUrl.current, draft.id)
      : null;
    savedCoverUrl.current = result.data.details.coverImageUrl;
    setDraft(result.data);
    let cleanupFailed = false;
    if (previousCoverPath && previousCoverPath !== uploadedCover?.objectPath) {
      try {
        const cleanup = await api.removeOrgSeminarCover(draft.id, previousCoverPath);
        cleanupFailed = !cleanup.ok;
      } catch {
        cleanupFailed = true;
      }
    }
    setSaving(false);
    setMessage(cleanupFailed ? 'Draft saved. The previous public cover could not be removed.' : 'Draft saved.');
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
  function applyPromptFormat(command: 'bold' | 'italic' | 'underline') { document.execCommand(command, false); }
  const formatButtons = (['bold', 'italic', 'underline'] as const).map((command) => <button key={command} type="button" aria-label={command[0].toUpperCase() + command.slice(1)} title={command[0].toUpperCase() + command.slice(1)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyPromptFormat(command)} className="flex h-9 w-9 items-center justify-center rounded-md font-body-sm-medium text-body-sm-medium text-text-secondary hover:bg-surface-container hover:text-primary"><span className={command === 'bold' ? 'font-bold' : command === 'italic' ? 'italic' : 'underline'}>{command === 'bold' ? 'B' : command === 'italic' ? 'I' : 'U'}</span></button>);
  const questionTools = <div className="flex h-fit gap-1 rounded-xl border border-border-subtle bg-surface-card p-1.5 shadow-sm md:flex-col"><div className="flex items-center gap-0.5 md:flex-col">{formatButtons}</div><span className="hidden border-t border-border-subtle md:block"/><button type="button" onClick={addQuestion} title="Add question after the selected card" aria-label="Add question after the selected card" className="flex h-11 flex-1 items-center justify-center rounded-lg text-primary hover:bg-primary/5 md:flex-none"><Icon name="add" size={22}/><span className="ml-2 font-body-sm-medium text-body-sm-medium md:hidden">Add question</span></button><span className="hidden border-t border-border-subtle md:block"/><button type="button" onClick={addQuestion} title="Add another question" aria-label="Add another question" className="hidden h-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-container md:flex"><Icon name="draft" size={20}/></button></div>;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary"><Link to="/org/my-seminars" className="hover:text-primary">My Seminars</Link><Icon name="chevron_right" size={16} /><span>Create seminar</span></nav><span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption text-text-secondary"><Icon name="cloud_done" size={16} />Draft editor</span></div>
        <header className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-end"><div><h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">{details.title || (draft.editingSeminarId ? 'Edit seminar' : 'Create seminar')}</h1></div><button type="button" onClick={async () => { const saved = await saveDraft(); if (saved) navigate('/org/my-seminars'); }} disabled={saving} className={actionTonal}><Icon name="save" size={18} />{saving ? 'Saving…' : 'Save and exit'}</button></header>

      <nav aria-label="Seminar setup steps" className="grid grid-cols-2 gap-space-sm sm:grid-cols-4">{STEPS.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`flex min-h-12 items-center gap-2 rounded-lg border px-space-sm text-left font-body-sm-medium text-body-sm-medium ${step === index ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle bg-surface-card text-text-secondary hover:bg-surface-container-low'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5">{index + 1}</span><span>{label}</span></button>)}</nav>

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}
      {message && <p role="status" className="rounded-lg bg-status-available-container p-space-md font-body-sm text-body-sm text-status-available">{message}</p>}

      <section className="rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card md:p-space-xl">
        {step === 0 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-title-lg text-title-lg text-on-surface">General information</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Required details are used in the schedule, attendee registration, and certificates.</p></div><div className="grid gap-space-md md:grid-cols-2">
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-2">Seminar title *<input required value={details.title ?? ''} onChange={(e) => updateDetails('title', e.target.value)} className={inputClass} placeholder="Enter seminar title" /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface">Seminar type *<select value={details.seminarType ?? 'seminar'} onChange={(e) => updateDetails('seminarType', e.target.value)} className={inputClass}><option value="seminar">Seminar</option><option value="webinar">Webinar</option></select></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-2">Seminar description *<textarea required rows={5} value={details.description ?? ''} onChange={(e) => updateDetails('description', e.target.value)} className={textareaClass} placeholder="Describe the seminar, its topics, and who should attend." /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface">Start date and time *<input type="datetime-local" value={localDateTime(details.startsAt)} onChange={(e) => updateDetails('startsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputClass} /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">End date and time *<input type="datetime-local" value={localDateTime(details.endsAt)} onChange={(e) => updateDetails('endsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputClass} /></label>
          {details.seminarType === 'webinar' ? <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-2">HTTPS join link *<input type="url" inputMode="url" value={details.joinUrl ?? ''} onChange={(e) => updateDetails('joinUrl', e.target.value)} className={inputClass} placeholder="https://…" /></label> : <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Venue / hall *<input value={details.venue ?? ''} onChange={(e) => updateDetails('venue', e.target.value)} className={inputClass} placeholder="Room or venue" /></label>}
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Target capacity *<input type="number" min={Math.max(1, activeCount)} value={details.capacity ?? ''} onChange={(e) => updateDetails('capacity', e.target.value ? Number(e.target.value) : undefined)} className={inputClass} placeholder="Number of seats" />{activeCount > 0 && <span className="font-caption text-caption text-text-secondary">At least {activeCount} active registrations are already on this seminar.</span>}</label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Confirmation opens (hours before start)<input type="number" min="2" value={details.confirmationOpensHoursBefore ?? 24} onChange={(e) => updateDetails('confirmationOpensHoursBefore', Number(e.target.value))} className={inputClass} /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Confirmation closes (hours before start)<input type="number" min="1" value={details.confirmationClosesHoursBefore ?? 1} onChange={(e) => updateDetails('confirmationClosesHoursBefore', Number(e.target.value))} className={inputClass} /></label>
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Lead speaker name *<input value={details.speakerName ?? ''} onChange={(e) => updateDetails('speakerName', e.target.value)} className={inputClass} placeholder="Full name" /></label>
          
          <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface">Required attendance (%)<input type="number" min="1" max="100" value={details.requiredAttendancePercent ?? 60} onChange={(e) => updateDetails('requiredAttendancePercent', Number(e.target.value))} className={inputClass} /></label>
          <div className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-2">Cover image<label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm text-text-secondary"><Icon name="upload_file" size={18} />Choose PNG, JPG, or WebP, up to 5 MiB<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onImage(e, 'cover')} className="sr-only" /></label><span className="font-caption text-caption text-text-secondary">Cover images are public after upload.</span>{details.coverImageUrl && <img src={details.coverImageUrl} alt="Seminar cover preview" className="max-h-48 rounded-lg border border-border-subtle object-cover" />}</div>
        </div></div>}

        {step === 1 && <CertificateDesigner certificate={draft.certificate} qrValue={`Seminex certificate template: ${draft.id}`} requiredAttendancePercent={details.requiredAttendancePercent ?? 60} onChangeBackground={(event) => void onImage(event, 'certificate')} onUpdateCanvasSize={updateCanvasSize} onUpdateField={updateNameBox} onUpdateGeometry={updateNameBoxGeometry} onUpdateQrCodeGeometry={updateQrCodeGeometry} onSelectSignature={(event, id) => void onSignatureImage(event, id)} onRemoveSignature={removeSignatureBox} onUpdateSignatureGeometry={updateSignatureGeometry} onReset={resetNameBox} />}

        {step === 2 && <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-md">
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-[minmax(0,1fr)_3.5rem] md:items-start"><article className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-sm"><div className="h-2 bg-primary"/><div className="flex flex-col gap-space-md p-space-lg md:p-space-xl"><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 font-label-sm text-label-sm text-primary"><Icon name="assignment_turned_in" size={16}/>Evaluation form</span><span className="font-caption text-caption text-text-secondary">{questions.length} {questions.length === 1 ? 'question' : 'questions'}</span></div><input aria-label="Form title" value={draft.survey?.title ?? ''} onChange={(event) => updateSurveyTitle(event.target.value)} className="h-12 border-b border-border-subtle bg-transparent font-title-lg text-title-lg font-bold text-on-surface outline-none placeholder:text-text-subtle focus:border-primary" placeholder="Untitled form"/><textarea aria-label="Form description" rows={2} value={draft.survey?.instructions ?? ''} onChange={(event) => updateSurveyInstructions(event.target.value)} className="resize-y border-b border-border-subtle bg-transparent py-2 font-body-sm text-body-sm text-text-secondary outline-none placeholder:text-text-subtle focus:border-primary" placeholder="Form description"/><p className="font-caption text-caption text-text-subtle">Participants will complete this evaluation after the seminar.</p></div></article><div aria-hidden="true" className="hidden md:block"/></div>
          {questions.length === 0 ? <div className="grid grid-cols-1 gap-space-md md:grid-cols-[minmax(0,1fr)_3.5rem] md:items-start"><article className="rounded-xl border border-dashed border-border-subtle bg-surface-light p-space-xl text-center"><Icon name="rate_review" size={26} className="mx-auto text-primary"/><h3 className="mt-2 font-title-md text-title-md text-on-surface">Add your first question</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Choose a response type and write a clear prompt for participants.</p></article>{questionTools}</div> : <div className="flex flex-col gap-space-md">{questions.map((question, index) => <div key={question.id} className="grid grid-cols-1 gap-space-md md:grid-cols-[minmax(0,1fr)_3.5rem] md:items-start"><QuestionEditor question={question} onChange={(next) => updateQuestion(index, next)} onRemove={() => updateQuestion(index, null)} onDuplicate={() => duplicateQuestion(index)} onActivate={() => setActiveQuestionId(question.id)} />{(activeQuestionId ?? questions[0]?.id) === question.id ? questionTools : <div className="hidden md:block"/>}</div>)}</div>}
          <p className="rounded-lg bg-surface-container-low p-space-md font-caption text-caption text-text-secondary">Responses are associated with the seminar and displayed according to the organization’s evaluation privacy rules.</p>
        </div>}

        {step === 3 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-title-lg text-title-lg text-on-surface">Review &amp; publish</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Finish the required setup before publishing the seminar to your organization schedule.</p></div><div className="grid gap-space-md md:grid-cols-2">{readiness?.items.map((item) => <div key={item.id} className="flex items-start gap-space-sm rounded-lg border border-border-subtle bg-surface-light p-space-md"><Icon name={item.passed ? 'check_circle' : 'error'} size={20} className={item.passed ? 'text-status-available' : 'text-status-full'} /><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{item.label}</p><p className="mt-1 font-caption text-caption text-text-secondary">{item.passed ? 'Complete' : item.reason}</p></div></div>)}</div><article className="rounded-xl border border-border-subtle bg-surface-container-low p-space-lg"><p className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">Seminar overview</p><h3 className="mt-2 font-headline-md text-headline-md text-primary">{details.title || 'Untitled seminar'}</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{details.startsAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(details.startsAt)) : 'Schedule not set'} · {details.venue || 'Venue not set'} · Capacity {details.capacity || '—'}</p><p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">{details.description || 'Add a description in the Details step.'}</p></article>{readiness?.firstBlockingReason && <p className="font-caption text-caption text-status-full">{readiness.firstBlockingReason}</p>}</div>}
      </section>

      <footer className="flex flex-col-reverse justify-between gap-space-sm sm:flex-row"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className={actionTonal}><Icon name="arrow_back" size={18} />Back</button><div className="flex flex-col-reverse gap-space-sm sm:flex-row"><button type="button" onClick={() => void saveDraft()} disabled={saving} className={actionTonal}><Icon name="save" size={18} />{saving ? 'Saving…' : 'Save draft'}</button>{step < STEPS.length - 1 ? <button type="button" onClick={async () => { const saved = await saveDraft(); if (saved) setStep((current) => Math.min(STEPS.length - 1, current + 1)); }} disabled={saving} className={actionPrimary}>Continue<Icon name="arrow_forward" size={18} /></button> : <button type="button" onClick={() => void publish()} disabled={saving || !readiness?.ready} className={actionPrimary}><Icon name="publish" size={18} />{saving ? 'Publishing…' : 'Publish seminar'}</button>}</div></footer>
    </PageContainer>
  );
}

