import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AuthoredSurvey, SeminarDraft } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { StepProgress } from '../../../components/auth/StepProgress';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { Icon } from '../../../components/ui/Icon';
import { CertificateDesigner } from '../components/CertificateDesigner';
import { CoverImageEditor, type CoverImageEditorHandle } from '../components/CoverImageEditor';
import { EvaluationBuilder } from '../components/EvaluationBuilder';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { getDraftReadiness } from '../readiness';
import { legacyCoverDataUrlToFile } from '../coverImage';
import { CERTIFICATE_RENDER_LIMITS, clampCertificateBox, isCertificateCanvasWithinLimits } from '../../../../supabase/functions/_shared/certificateConstraints';

const STEPS = ['Details', 'Certificate', 'Evaluation', 'Review & Publish'] as const;
const inputClass = 'h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm text-on-surface outline-none transition-colors placeholder:text-text-subtle focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20';
const textareaClass = 'w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 py-3 font-body-sm text-body-sm text-on-surface outline-none placeholder:text-text-subtle focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20';

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string | undefined | null {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function certificateImageAsDataUrl(file: File): Promise<string> {
  if (!file.size || file.size > CERTIFICATE_RENDER_LIMITS.maxImageBytes) throw new Error('validation_failed');
  if (file.type === 'image/svg+xml') return await fileAsDataUrl(file);
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') throw new Error('validation_failed');

  const bitmap = await createImageBitmap(file);
  try {
    if (!isCertificateCanvasWithinLimits(bitmap.width, bitmap.height)) {
      throw new Error('validation_failed');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('validation_failed');
    context.drawImage(bitmap, 0, 0);
    const normalized = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== 'image/png' || !blob.size || blob.size > CERTIFICATE_RENDER_LIMITS.maxImageBytes) {
          reject(new Error('validation_failed'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
    return await fileAsDataUrl(new File([normalized], 'certificate-background.png', { type: 'image/png' }));
  } finally {
    bitmap.close();
  }
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

export default function SeminarEditorPage() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const listing = useResource(() => api.listOrgSeminars({ seminars: { pageSize: 1 }, drafts: { pageSize: 999 } }), `org-editor-${draftId}`);
  const source = listing.state.status === 'success' ? listing.state.data.drafts.items.find((item) => item.id === draftId) : undefined;
  const [draft, setDraft] = useState<SeminarDraft | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<{ startsAt?: string; endsAt?: string }>({});
  const [editingCoverUrl, setEditingCoverUrl] = useState<string | null>(null);
  const coverEditorRef = useRef<CoverImageEditorHandle>(null);
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

  function updateSchedule(field: 'startsAt' | 'endsAt', value: string) {
    const parsed = localDateTimeToIso(value);
    if (parsed === null) {
      setScheduleErrors((current) => ({ ...current, [field]: 'Enter a complete date and time.' }));
      return;
    }
    setScheduleErrors((current) => ({ ...current, [field]: undefined }));
    updateDetails(field, parsed);
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

  function updateCanvasSize(width: number, height: number) {
    setDraft((current) => {
      const certificate = current?.certificate;
      if (!current || !certificate || !isCertificateCanvasWithinLimits(width, height)) return current;
      return {
        ...current,
        certificate: {
          ...certificate,
          canvasWidth: width,
          canvasHeight: height,
          nameBox: clampCertificateBox(certificate.nameBox, width, height),
          ...(certificate.qrCodeBox ? { qrCodeBox: clampCertificateBox(certificate.qrCodeBox, width, height) } : {}),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function updateNameBox(field: keyof NonNullable<SeminarDraft['certificate']>['nameBox'], value: string | number | boolean) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { ...current.certificate.nameBox, [field]: value }, updatedAt: new Date().toISOString() } } : current);
  }

  function updateNameBoxGeometry(value: Pick<NonNullable<SeminarDraft['certificate']>['nameBox'], 'x' | 'y' | 'width' | 'height'>) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, nameBox: { ...current.certificate.nameBox, ...value }, updatedAt: new Date().toISOString() } } : current);
  }

  function updateQrCodeGeometry(value: Pick<NonNullable<SeminarDraft['certificate']>['nameBox'], 'x' | 'y' | 'width' | 'height'>) {
    setDraft((current) => current?.certificate ? { ...current, certificate: { ...current.certificate, qrCodeBox: value, updatedAt: new Date().toISOString() } } : current);
  }

  function resetNameBox() {
    setDraft((current) => {
      if (!current?.certificate) return current;
      const canvasWidth = current.certificate.canvasWidth ?? 1920;
      const canvasHeight = current.certificate.canvasHeight ?? 1080;
      return {
        ...current,
        certificate: {
          ...current.certificate,
          nameBox: clampCertificateBox(
            { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, lineHeight: 90, fontWeight: 700, align: 'center', color: '#1B365D' },
            canvasWidth,
            canvasHeight,
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function updateSurvey(next: AuthoredSurvey) {
    setDraft((current) => (current ? { ...current, survey: next } : current));
  }

  async function saveDraft(): Promise<SeminarDraft | null> {
    if (!draft || saving) return null;
    setSaving(true); setFailure(null); setMessage(null);
    let draftToSave = draft;

    // If the cover cropper is still open when the user clicks Save draft / Continue,
    // automatically commit the current framed 16:9 crop so the cover image is never lost.
    if (editingCoverUrl) {
      const committed =
        coverEditorRef.current?.exportCrop() ??
        (editingCoverUrl.startsWith('data:') ? editingCoverUrl : null);
      if (committed) {
        draftToSave = { ...draftToSave, details: { ...draftToSave.details, coverImageUrl: committed } };
        setEditingCoverUrl(null);
      }
    }

    let uploadedCover: { publicUrl: string; objectPath: string } | null = null;
    if (draftToSave.details.coverImageUrl?.startsWith('data:')) {
      let file: File;
      try {
        file = legacyCoverDataUrlToFile(draftToSave.details.coverImageUrl);
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
      draftToSave = { ...draftToSave, details: { ...draftToSave.details, coverImageUrl: uploadedCover.publicUrl } };
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
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFailure('Choose an image file for the seminar cover or certificate.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFailure('Choose an image smaller than 5 MB.'); return; }
    try {
      const dataUrl = target === 'certificate' ? await certificateImageAsDataUrl(file) : await fileAsDataUrl(file);
      if (target === 'cover') setEditingCoverUrl(dataUrl);
      else updateCertificate('backgroundUrl', dataUrl);
    } catch { setFailure('The image could not be read. Please choose another file.'); }
  }

  if (listing.state.status === 'loading') return <PageContainer><LoadingRegion label="Loading seminar draft"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-[34rem] rounded-xl" /></LoadingRegion></PageContainer>;
  if (listing.state.status === 'error') return <PageContainer><StateMessage role="alert" icon="info" title="Draft could not be loaded" action={<RetryButton onClick={listing.reload} />}>Check your connection and try again.</StateMessage></PageContainer>;
  if (!draft) return <PageContainer><StateMessage role="status" icon="draft" title="Draft not found" action={<Link to="/org/my-seminars" className={actionPrimary}>Back to My Seminars</Link>}>This draft may have been published or removed.</StateMessage></PageContainer>;

  const details = draft.details;
  const datesOutOfOrder = Boolean(details.startsAt && details.endsAt && Date.parse(details.endsAt) <= Date.parse(details.startsAt));

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary">
          <Link to="/org/my-seminars" className="hover:text-primary">My Seminars</Link>
          <Icon name="chevron_right" size={16} />
          <span>Create seminar</span>
        </nav>
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-caption text-caption transition-colors ${
            message
              ? 'bg-status-available-container text-status-available'
              : 'bg-surface-container-low text-text-secondary'
          }`}
        >
          <Icon name={saving ? 'sync' : message ? 'check_circle' : 'cloud_done'} size={16} className={saving ? 'animate-spin' : undefined} />
          <span>{saving ? 'Saving draft…' : message ?? 'Draft editor'}</span>
        </span>
      </div>
        <header className="flex flex-col justify-between gap-space-md border-b border-border-subtle pb-space-lg sm:flex-row sm:items-end">
          <div>
            <h1 className="font-headline-xl text-headline-xl-mobile tracking-[-0.02em] text-on-surface md:text-headline-xl">
              {details.title || (draft.editingSeminarId ? 'Edit seminar' : 'Create seminar')}
            </h1>
          </div>
        </header>

      <StepProgress
        current={step + 1}
        steps={STEPS.map((label, index) => ({ step: index + 1, label }))}
        onSelect={(selected) => {
          if (step === 0 && editingCoverUrl) {
            const committed =
              coverEditorRef.current?.exportCrop() ??
              (editingCoverUrl.startsWith('data:') ? editingCoverUrl : null);
            if (committed) updateDetails('coverImageUrl', committed);
            setEditingCoverUrl(null);
          }
          setStep(selected - 1);
        }}
      />

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}

      <section className={step === 2 ? 'border-0 bg-transparent p-0 shadow-none' : 'rounded-xl border border-border-subtle bg-surface-card p-space-lg md:p-space-xl'}>
        {step === 0 && (
          <div className="flex flex-col gap-space-xl">
            <div className="flex flex-col gap-3 border-b border-border-subtle pb-space-lg">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Cover image</h2>
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                  Standard 16:9 public cover ratio. Cover images are public after upload.
                </p>
              </div>
              <label className="flex min-h-11 w-full max-w-md cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm text-text-secondary transition-colors hover:border-outline-variant hover:text-on-surface">
                <Icon name="upload_file" size={18} />
                <span>{details.coverImageUrl ? 'Replace cover image (PNG, JPG, or WebP, up to 5 MiB)' : 'Choose PNG, JPG, or WebP, up to 5 MiB'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onImage(e, 'cover')} className="sr-only" />
              </label>
              {editingCoverUrl ? (
                <CoverImageEditor
                  ref={coverEditorRef}
                  sourceUrl={editingCoverUrl}
                  onApply={(cropped) => {
                    updateDetails('coverImageUrl', cropped);
                    setEditingCoverUrl(null);
                  }}
                  onCancel={() => setEditingCoverUrl(null)}
                />
              ) : details.coverImageUrl ? (
                <div className="flex flex-col gap-space-sm">
                  <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-border-subtle bg-surface-container-low">
                    <img src={details.coverImageUrl} alt="Seminar cover preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-wrap items-center gap-space-sm">
                    <button
                      type="button"
                      onClick={() => setEditingCoverUrl(details.coverImageUrl ?? null)}
                      className={actionTonal}
                    >
                      <Icon name="edit" size={18} />
                      <span>Adjust framing</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDetails('coverImageUrl', undefined)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-body-sm-medium text-body-sm-medium text-danger transition-colors hover:bg-danger-surface"
                    >
                      <Icon name="delete" size={18} />
                      <span>Remove cover</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-space-lg">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">General information</h2>
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                  Required details are used in the schedule, attendee registration, and certificates.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-space-md md:grid-cols-12">
                <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-8">
                  Seminar title
                  <input required value={details.title ?? ''} onChange={(e) => updateDetails('title', e.target.value)} className={inputClass} placeholder="Enter seminar title" />
                </label>
                <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-4">
                  Seminar type
                  <select value={details.seminarType ?? 'seminar'} onChange={(e) => updateDetails('seminarType', e.target.value)} className={inputClass}>
                    <option value="seminar">Seminar</option>
                    <option value="webinar">Webinar</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-12">
                  Seminar description
                  <textarea required rows={4} value={details.description ?? ''} onChange={(e) => updateDetails('description', e.target.value)} className={textareaClass} placeholder="Describe the seminar, its topics, and who should attend." />
                </label>

                <label className="flex flex-col gap-2 font-body-sm-medium text-body-sm-medium text-on-surface md:col-span-6 xl:col-span-3">
                  Start date and time
                  <input required type="datetime-local" value={localDateTime(details.startsAt)} onChange={(e) => updateSchedule('startsAt', e.target.value)} aria-invalid={Boolean(scheduleErrors.startsAt)} aria-describedby={scheduleErrors.startsAt ? 'starts-at-error' : undefined} className={inputClass} />
                  {scheduleErrors.startsAt && <span id="starts-at-error" role="alert" className="font-caption text-caption text-danger">{scheduleErrors.startsAt}</span>}
                </label>
                <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-6 xl:col-span-3">
                  End date and time
                  <input required type="datetime-local" value={localDateTime(details.endsAt)} onChange={(e) => updateSchedule('endsAt', e.target.value)} aria-invalid={Boolean(scheduleErrors.endsAt || datesOutOfOrder)} aria-describedby={scheduleErrors.endsAt || datesOutOfOrder ? 'ends-at-error' : undefined} className={inputClass} />
                  {(scheduleErrors.endsAt || datesOutOfOrder) && <span id="ends-at-error" role="alert" className="font-caption text-caption text-danger">{scheduleErrors.endsAt ?? 'End date and time must be after the start.'}</span>}
                </label>
                {details.seminarType === 'webinar' ? (
                  <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-8 xl:col-span-4">
                    HTTPS join link
                    <input required type="url" inputMode="url" value={details.joinUrl ?? ''} onChange={(e) => updateDetails('joinUrl', e.target.value)} className={inputClass} placeholder="https://…" />
                  </label>
                ) : (
                  <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-8 xl:col-span-4">
                    Venue / hall
                    <input required value={details.venue ?? ''} onChange={(e) => updateDetails('venue', e.target.value)} className={inputClass} placeholder="Room or venue" />
                  </label>
                )}
                <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-4 xl:col-span-2">
                  Target capacity
                  <input required type="number" min={Math.max(1, activeCount)} value={details.capacity ?? ''} onChange={(e) => updateDetails('capacity', e.target.value ? Number(e.target.value) : undefined)} className={inputClass} placeholder="Seats" />
                  {activeCount > 0 && <span className="font-caption text-caption text-text-secondary">At least {activeCount} active registrations.</span>}
                </label>

                <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-6">
                  Lead speaker name
                  <input required value={details.speakerName ?? ''} onChange={(e) => updateDetails('speakerName', e.target.value)} className={inputClass} placeholder="Full name" />
                </label>
                <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-3">
                  Confirmation opens (minutes before)
                  <input type="number" min="1" max="10080" value={details.confirmationOpensMinutesBefore ?? 1440} onChange={(e) => updateDetails('confirmationOpensMinutesBefore', Number(e.target.value))} className={inputClass} />
                </label>
                <label className="flex flex-col gap-2 font-body-sm-medium text-on-surface md:col-span-3">
                  Confirmation closes (minutes before)
                  <input type="number" min="1" max="10080" value={details.confirmationClosesMinutesBefore ?? 60} onChange={(e) => updateDetails('confirmationClosesMinutesBefore', Number(e.target.value))} className={inputClass} />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 1 && <CertificateDesigner certificate={draft.certificate} qrValue={`Seminex certificate template: ${draft.id}`} onChangeBackground={(event) => void onImage(event, 'certificate')} onUpdateCanvasSize={updateCanvasSize} onUpdateField={updateNameBox} onUpdateGeometry={updateNameBoxGeometry} onUpdateQrCodeGeometry={updateQrCodeGeometry} onReset={resetNameBox} />}

        {step === 2 && draft.survey && (
          <EvaluationBuilder survey={draft.survey} onChange={updateSurvey} />
        )}

        {step === 3 && <div className="flex flex-col gap-space-lg"><div><h2 className="font-headline-sm text-headline-sm text-on-surface">Review &amp; publish</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Finish the required setup before publishing the seminar to your organization schedule.</p></div><div className="grid gap-space-md md:grid-cols-2">{readiness?.items.map((item) => <div key={item.id} className="flex items-start gap-space-sm rounded-lg border border-border-subtle bg-surface-light p-space-md"><Icon name={item.passed ? 'check_circle' : 'error'} size={20} className={item.passed ? 'text-status-available' : 'text-status-full'} /><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{item.label}</p><p className="mt-1 font-caption text-caption text-text-secondary">{item.passed ? 'Complete' : item.reason}</p></div></div>)}</div><article className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-container-low p-space-lg md:flex-row md:items-start">{details.coverImageUrl && <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-card md:w-64"><img src={details.coverImageUrl} alt="Seminar cover preview" className="h-full w-full object-cover" /></div>}<div className="min-w-0 flex-1"><p className="font-label-sm text-label-sm text-text-secondary">Seminar overview</p><h3 className="mt-2 font-headline-md text-headline-md text-primary">{details.title || 'Untitled seminar'}</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{details.startsAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(details.startsAt)) : 'Schedule not set'} · {details.venue || 'Venue not set'} · Capacity {details.capacity || '—'}</p><p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">{details.description || 'Add a description in the Details step.'}</p></div></article>{readiness?.firstBlockingReason && <p className="font-caption text-caption text-status-full">{readiness.firstBlockingReason}</p>}</div>}
      </section>

      <footer className="flex flex-col-reverse justify-between gap-space-sm sm:flex-row"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className={actionTonal}><Icon name="arrow_back" size={18} />Back</button><div className="flex flex-col-reverse gap-space-sm sm:flex-row"><button type="button" onClick={() => void saveDraft()} disabled={saving} className={actionTonal}><Icon name="save" size={18} />{saving ? 'Saving…' : 'Save draft'}</button>{step < STEPS.length - 1 ? <button type="button" onClick={async () => { const saved = await saveDraft(); if (saved) setStep((current) => Math.min(STEPS.length - 1, current + 1)); }} disabled={saving} className={actionPrimary}>Continue<Icon name="arrow_forward" size={18} /></button> : <button type="button" onClick={() => void publish()} disabled={saving || !readiness?.ready} className={actionPrimary}><Icon name="publish" size={18} />{saving ? 'Publishing…' : 'Publish seminar'}</button>}</div></footer>
    </PageContainer>
  );
}

