import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionDisabled, actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { expireSession } from '../../../session/storage';
import { formatClockTime, formatDate, formatTimeRange } from '../../seminars/format';
import { getAttendance } from '../../seminars/status';
import { buildHistoryRecords, type HistoryRecord } from '../records';
import { RecordStatusBadge } from '../components/RecordStatusBadge';
import { saveBlob } from '../saveBlob';

function SummaryHeading({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
      <Icon name="schedule" size={24} className="text-primary-container" />
      {children}
    </h2>
  );
}

function CheckResult({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-body-sm text-body-sm text-text-secondary">{children}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 font-body-sm-medium text-body-sm-medium ${met ? 'text-status-available' : 'text-error'}`}>
        <Icon name={met ? 'check_circle' : 'close'} size={16} />
        {met ? 'Met' : 'Not met'}
      </span>
    </div>
  );
}

function AttendanceProgress({ record, attendedMinutes, durationMinutes }: {
  record: HistoryRecord;
  attendedMinutes: number | null;
  durationMinutes: number;
}) {
  const percent = record.attendancePercent;
  const threshold = record.requiredPercent;
  const marker = Math.min(97, Math.max(3, threshold));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <span className="font-body-sm text-body-sm text-text-secondary">Logged duration</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="font-title-md text-title-md text-on-surface">
            {attendedMinutes === null ? 'Not counted' : `${attendedMinutes} of ${durationMinutes} minutes`}
          </span>
          <span className={`font-headline-sm text-headline-sm font-bold ${percent !== null && percent >= threshold ? 'text-status-available' : percent === null ? 'text-text-subtle' : 'text-error'}`}>
            {percent === null ? 'N/A' : `${percent}%`}
          </span>
        </div>
      </div>
      <div className="relative w-full pb-7 pt-1">
        <div
          role="progressbar"
          aria-label="Counted attendance toward the required minimum"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? 0}
          aria-valuetext={percent === null ? 'Attendance not counted' : `${percent} percent attended`}
          className="h-3 w-full overflow-hidden rounded-full bg-surface-container"
        >
          <div
            className={`h-full rounded-full ${percent === null ? 'bg-surface-container-high' : percent >= threshold ? 'bg-status-available' : 'bg-error'}`}
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
        <div className="absolute bottom-0 top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${marker}%` }}>
          <div className="h-5 w-0.5 bg-on-surface" />
          <span className="mt-1 whitespace-nowrap font-caption text-caption tabular-nums text-text-subtle">
            Required: {Math.ceil((durationMinutes * threshold) / 100)} minutes ({threshold}%)
          </span>
        </div>
      </div>
      {percent === null && (
        <p className="font-caption text-caption text-text-secondary">
          Attendance is counted after a Time-Out is recorded and validated.
        </p>
      )}
    </div>
  );
}

function Checkpoint({
  title,
  at,
  detail,
  state,
}: {
  title: string;
  at: string | null;
  detail: string;
  state: 'met' | 'pending' | 'missing';
}) {
  const stateText = state === 'met' ? 'Validated' : state === 'pending' ? 'Awaiting validation' : 'Not recorded';
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-light p-4">
      <span className="font-caption text-caption text-text-subtle">{title}</span>
      <span className="font-body-base-medium text-body-base-medium tabular-nums text-on-surface">
        {detail}: {at ? formatClockTime(at) : 'Not recorded'}
      </span>
      <span className={`inline-flex items-center gap-1 pt-1 font-body-sm-medium text-body-sm-medium ${state === 'met' ? 'text-status-available' : state === 'pending' ? 'text-secondary-accent' : 'text-text-subtle'}`}>
        <Icon name={state === 'met' ? 'check_circle' : state === 'pending' ? 'pending_actions' : 'info'} size={16} />
        {stateText}
      </span>
    </div>
  );
}

export default function HistorySummaryPage() {
  const { id = '' } = useParams();
  const now = useNow();
  const resource = useResource(() => api.getSeminar(id), `history-summary-${id}`);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    key: string;
    blob: Blob | null;
    url: string | null;
    error: string | null;
  } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const item = resource.state.status === 'success' ? resource.state.data : null;
  const record = item && now !== null ? (buildHistoryRecords([item], now)[0] ?? null) : null;
  const readySeminarId = record?.status === 'ready' ? record.seminar.id : null;
  const previewKey = readySeminarId ? `${readySeminarId}:${previewAttempt}` : null;
  const activePreview = previewKey && preview?.key === previewKey ? preview : null;
  const previewStatus = !previewKey
    ? 'idle'
    : !activePreview
      ? 'loading'
      : activePreview.url
        ? 'ready'
        : 'error';
  const previewBlob = activePreview?.blob ?? null;
  const previewUrl = activePreview?.url ?? null;
  const previewError = activePreview?.error ?? null;

  useEffect(() => {
    document.title = record ? `${record.seminar.title} summary - Seminex` : 'History summary - Seminex';
  }, [record]);

  useEffect(() => {
    if (!readySeminarId || !previewKey) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void api.getCertificate(readySeminarId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        objectUrl = URL.createObjectURL(result.data);
        setPreview({ key: previewKey, blob: result.data, url: objectUrl, error: null });
        return;
      }
      if (result.error.code === 'session_expired') {
        expireSession();
        return;
      }
      setPreview({
        key: previewKey,
        blob: null,
        url: null,
        error:
          result.error.code === 'not_available'
            ? 'Your certificate preview is not available yet.'
            : errorText(result.error.code),
      });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [readySeminarId, previewKey]);

  async function handleDownload() {
    if (!record || record.status !== 'ready' || downloading) return;
    setDownloadError(null);
    if (previewBlob) {
      saveBlob(previewBlob, `${record.seminar.reference}-certificate.pdf`);
      return;
    }
    setDownloading(true);
    const result = await api.getCertificate(record.seminar.id);
    setDownloading(false);
    if (result.ok) {
      saveBlob(result.data, `${record.seminar.reference}-certificate.pdf`);
      return;
    }
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    setDownloadError(
      result.error.code === 'not_available'
        ? 'Your certificate file is not available to download yet. Try again later.'
        : errorText(result.error.code),
    );
  }

  if (resource.state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingRegion label="Loading seminar summary" className="flex flex-col gap-space-lg">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
            <Skeleton className="h-[34rem] w-full rounded-xl lg:col-span-7" />
            <Skeleton className="h-[34rem] w-full rounded-xl lg:col-span-5" />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (resource.state.status === 'error') {
    return (
      <PageContainer>
        <StateMessage
          role="alert"
          icon="info"
          title={resource.state.code === 'not_found' ? 'Seminar summary not found' : 'The summary could not be loaded'}
          action={resource.state.code === 'not_found' ? <Link to="/history" className={actionPrimary}>Back to History</Link> : <RetryButton onClick={resource.reload} />}
        >
          {errorText(resource.state.code)}
        </StateMessage>
      </PageContainer>
    );
  }

  if (now === null) {
    return <PageContainer><StateMessage icon="schedule" title="Current seminar time is unavailable">Reconnect to load authoritative seminar time before calculating attendance and certificate eligibility.</StateMessage></PageContainer>;
  }

  if (!record) {
    return (
      <PageContainer>
        <StateMessage
          icon="history"
          title="This seminar is not in your history"
          action={<Link to="/history" className={actionPrimary}>Back to History</Link>}
        >
          History summaries are available for seminars you registered for after they finish.
        </StateMessage>
      </PageContainer>
    );
  }

  const { seminar, registration } = record;
  const attendance = getAttendance(seminar, registration, now);
  const counted = registration.timeOut?.validated === true && registration.timeIn !== null;
  const attendedMinutes = counted ? attendance.attendedMinutes : null;
  const hasMinimumAttendance = record.status === 'ready' || record.status === 'evaluation_pending';
  const checkpointsValidated = registration.timeIn !== null && registration.timeOut?.validated === true;
  const certificateReady = record.status === 'ready';
  const evaluationDate = registration.evaluationSubmittedAt;
  const attendanceAlert = (() => {
    switch (record.status) {
      case 'below_minimum':
        return `Attendance below ${record.requiredPercent}%: you attended ${attendance.attendedMinutes} of ${attendance.durationMinutes} minutes.`;
      case 'no_time_out':
        return 'A Time-Out is missing, so attendance cannot be counted and a certificate cannot be issued.';
      case 'time_out_unvalidated':
        return 'Your Time-Out is awaiting validation. Attendance and certificate eligibility will update after review.';
      default:
        return null;
    }
  })();

  return (
    <PageContainer>
      <header className="flex flex-col gap-space-md border-b border-border-subtle pb-space-lg">
        <Link to="/history" className="inline-flex min-h-11 w-fit items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-text-secondary transition-colors hover:text-primary">
          <Icon name="arrow_back" size={18} />
          History
        </Link>
        <div className="flex flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-xl text-headline-xl-mobile tracking-[-0.02em] text-on-surface md:text-headline-xl">{seminar.title}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-finished-container px-2.5 py-1 font-label-sm text-label-sm text-status-finished">
              <Icon name="flag" size={14} />Finished
            </span>
            <RecordStatusBadge status={record.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 font-body-sm text-body-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Icon name="calendar_today" size={18} className="text-text-subtle" />
              {formatDate(seminar.startsAt)}, {formatTimeRange(seminar.startsAt, seminar.endsAt)} ({attendance.durationMinutes} minutes)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="person" size={18} className="text-text-subtle" />{seminar.speaker.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="location_on" size={18} className="text-text-subtle" />{seminar.venue}
            </span>
          </div>
        </div>
      </header>

      {resource.state.status === 'success' && resource.state.fromCache && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary">
          <Icon name="info" size={18} />You are offline. Showing the saved copy of this seminar summary.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-7">
          <section className="flex flex-col gap-space-lg rounded-xl border border-border-subtle bg-surface-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <SummaryHeading>Attendance</SummaryHeading>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm uppercase ${checkpointsValidated ? 'bg-status-available-container text-status-available' : registration.timeOut && !registration.timeOut.validated ? 'bg-status-finished-container text-status-finished' : 'bg-status-full-container text-status-full'}`}>
                <Icon name={checkpointsValidated ? 'check_circle' : 'info'} size={14} />
                {checkpointsValidated ? 'Validated' : registration.timeOut ? 'Awaiting validation' : 'Incomplete'}
              </span>
            </div>

            <AttendanceProgress record={record} attendedMinutes={attendedMinutes} durationMinutes={attendance.durationMinutes} />

            <div className="grid grid-cols-1 gap-space-md pt-1 sm:grid-cols-2">
              <Checkpoint
                title="Arrival checkpoint"
                at={registration.timeIn?.at ?? null}
                detail="Time-In"
                state={registration.timeIn ? 'met' : 'missing'}
              />
              <Checkpoint
                title="Departure checkpoint"
                at={registration.timeOut?.at ?? null}
                detail="Time-Out"
                state={!registration.timeOut ? 'missing' : registration.timeOut.validated ? 'met' : 'pending'}
              />
            </div>
          </section>

          <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-5 md:p-6">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Icon name="rate_review" size={24} className="text-primary-container" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Evaluation</h2>
            </div>
            {evaluationDate ? (
              <div className="flex flex-col gap-3 rounded-lg bg-surface-light p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon name="check_circle" size={20} className="text-status-available" />
                  <span className="font-body-base-medium text-body-base-medium tabular-nums text-on-surface">Submitted on {formatDate(evaluationDate)} at {formatClockTime(evaluationDate)}</span>
                </div>
                <span className="font-caption text-caption text-text-subtle">Completed</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg bg-surface-light p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon name="pending_actions" size={20} className="text-secondary-accent" />
                  <span className="font-body-base-medium text-body-base-medium text-on-surface">Post-seminar feedback required</span>
                </div>
                {record.evaluationDue ? (
                  <Link to={`/my-seminars/${seminar.id}/evaluation`} className={`${actionPrimary} self-start px-4 sm:self-auto`}>
                    <Icon name="rate_review" size={16} />Answer evaluation
                  </Link>
                ) : (
                  <span className="font-caption text-caption text-text-subtle">Available after Time-Out validation</span>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5">
          <section className="flex flex-col gap-space-lg rounded-xl border border-border-subtle bg-surface-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Icon name="workspace_premium" size={24} className="text-primary-container" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Certificate</h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm uppercase ${certificateReady ? 'bg-status-available-container text-status-available' : 'bg-error-container text-error'}`}>
                <Icon name={certificateReady ? 'verified' : 'close'} size={14} />
                {certificateReady ? 'Ready' : record.status === 'evaluation_pending' ? 'Pending' : 'Not met'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-caption text-caption font-semibold text-text-subtle">Eligibility verification</span>
              <CheckResult met={hasMinimumAttendance}>Attended at least {record.requiredPercent}%</CheckResult>
              <CheckResult met={checkpointsValidated}>Time-In and Time-Out validated</CheckResult>
              <CheckResult met={record.evaluationSubmitted}>Evaluation submitted</CheckResult>
            </div>

            {certificateReady ? (
              <div className="flex flex-col gap-space-sm">
                {previewStatus === 'loading' || previewStatus === 'idle' ? (
                  <LoadingRegion label="Loading certificate preview">
                    <Skeleton className="aspect-[1.414/1] w-full rounded-lg" />
                  </LoadingRegion>
                ) : previewStatus === 'ready' && previewUrl ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-low">
                      <iframe
                        title={`Certificate for ${seminar.title}`}
                        src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        className="aspect-[1.414/1] w-full bg-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 px-2 font-body-sm-medium text-body-sm-medium text-primary transition-colors hover:text-maroon-dark"
                      >
                        <span>Open full screen</span>
                        <Icon name="open_in_new" size={16} />
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-space-sm rounded-lg bg-surface-container-low p-space-lg text-center">
                    <Icon name="workspace_premium" size={28} className="text-primary" />
                    <p className="font-body-sm text-body-sm text-text-secondary">
                      {previewError ?? 'Could not load certificate preview.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewAttempt((attempt) => attempt + 1)}
                      className="inline-flex min-h-11 items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-primary underline"
                    >
                      <Icon name="refresh" size={16} />
                      <span>Retry preview</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex items-start gap-2 rounded-lg p-3 font-body-sm text-body-sm ${record.status === 'evaluation_pending' ? 'bg-status-ongoing-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                <Icon name="info" size={18} className="mt-0.5 shrink-0" />
                <span>
                  {record.status === 'evaluation_pending'
                    ? 'Submit the evaluation to unlock your certificate.'
                    : attendanceAlert ?? 'Complete the certificate requirements to unlock your certificate.'}
                </span>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={!certificateReady || downloading}
                aria-busy={downloading || undefined}
                className={certificateReady ? `${actionPrimary} w-full` : `${actionDisabled} w-full`}
              >
                <Icon name={certificateReady ? 'download' : 'lock'} size={18} />
                {downloading ? 'Preparing certificate...' : 'Download certificate'}
              </button>
              {downloadError && <p role="alert" className="mt-2 font-caption text-caption text-error">{downloadError}</p>}
            </div>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
