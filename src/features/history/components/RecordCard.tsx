import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { actionDisabled, actionPrimary } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { expireSession } from '../../../session/storage';
import { formatClockTime, formatDate, formatTimeRange } from '../../seminars/format';
import type { HistoryRecord } from '../records';
import { saveBlob } from '../saveBlob';
import { AttendanceMeter } from './AttendanceMeter';
import { RecordStatusBadge } from './RecordStatusBadge';

/** Why a certificate cannot be issued, written as visible text (never only a tooltip). */
function ineligibleReason(record: HistoryRecord): string {
  switch (record.status) {
    case 'below_minimum':
      return `Minimum ${record.requiredPercent}% attendance required. You attended ${record.attendancePercent}%.`;
    case 'no_time_out':
      return record.registration.timeIn
        ? 'No Time-Out recorded, so your attendance cannot be counted.'
        : 'No Time-In or Time-Out recorded, so your attendance cannot be counted.';
    default:
      return 'Your Time-Out is recorded but not validated yet. Attendance is counted once it is validated.';
  }
}

function attendanceHeading(record: HistoryRecord): string {
  switch (record.status) {
    case 'below_minimum':
      return 'Attendance recorded, below minimum';
    case 'no_time_out':
    case 'time_out_unvalidated':
      return 'Attendance not counted';
    default:
      return 'Attendance recorded';
  }
}

function attendanceDetail(record: HistoryRecord): string {
  const { timeIn, timeOut } = record.registration;
  const timeInText = timeIn ? formatClockTime(timeIn.at) : 'Not recorded';
  let timeOutText = 'Not recorded';
  if (timeOut) {
    timeOutText = formatClockTime(timeOut.at) + (timeOut.validated ? '' : ' (not validated)');
  }
  return `Time-In: ${timeInText} \u00b7 Time-Out: ${timeOutText}`;
}

export function RecordCard({ record }: { record: HistoryRecord }) {
  const { seminar, registration, status } = record;
  const titleId = useId();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDownload() {
    if (downloading) return;
    setMessage(null);
    setDownloading(true);
    const result = await api.getCertificate(seminar.id);
    setDownloading(false);
    if (result.ok) {
      saveBlob(result.data, `${seminar.reference}-certificate.pdf`);
      return;
    }
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    setMessage(
      result.error.code === 'not_available'
        ? 'Your certificate file is not available to download yet. Try again later.'
        : errorText(result.error.code),
    );
  }

  const evaluationDate = registration.evaluationSubmittedAt ? formatDate(registration.evaluationSubmittedAt) : null;
  const evaluationDone = record.evaluationSubmitted;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col justify-between gap-space-lg rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card transition-shadow hover:shadow-card-hover lg:flex-row lg:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col lg:max-w-2xl">
        <div className="mb-space-xs flex flex-wrap items-center gap-space-sm">
          <RecordStatusBadge status={status} />
          <span className="font-caption text-caption text-text-secondary">{seminar.venue}</span>
        </div>
        <h2 id={titleId} className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
          <Link to={`/history/${seminar.id}`} className="rounded-sm underline-offset-2 hover:text-primary hover:underline focus-visible:outline-primary">
            {seminar.title}
          </Link>
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-body-sm text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar_today" size={16} className="text-text-subtle" />
            {formatDate(seminar.startsAt)} {'\u00b7'} {formatTimeRange(seminar.startsAt, seminar.endsAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="person" size={16} className="text-text-subtle" />
            <span className="sr-only">Speaker: </span>
            {seminar.speaker.name}
          </span>
        </div>

        <div className="mt-space-md flex flex-wrap items-center gap-x-space-xl gap-y-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <div className="flex items-center gap-space-sm">
            <AttendanceMeter percent={record.attendancePercent} met={status === 'ready' || status === 'evaluation_pending'} />
            <div className="flex flex-col">
              <span className="font-caption text-caption text-text-secondary">{attendanceHeading(record)}</span>
              <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{attendanceDetail(record)}</span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <span
              aria-hidden="true"
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-full',
                evaluationDone ? 'bg-status-available-container text-status-available' : 'bg-status-ongoing-container text-status-ongoing',
              )}
            >
              <Icon name={evaluationDone ? 'task_alt' : 'pending_actions'} size={18} />
            </span>
            <div className="flex flex-col">
              <span className="font-caption text-caption text-text-secondary">Evaluation status</span>
              <span className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {evaluationDone ? `Submitted${evaluationDate ? ` (${evaluationDate})` : ''}` : 'Not submitted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-space-sm lg:max-w-xs lg:items-end">
        {status === 'ready' && (
          <>
            <button
              type="button"
              onClick={() => void handleDownload()}
              aria-disabled={downloading || undefined}
              aria-busy={downloading || undefined}
              aria-label={`Download certificate for ${seminar.title}`}
              className={cx(actionPrimary, downloading && 'cursor-wait opacity-90')}
            >
              {downloading ? <Spinner /> : <Icon name="download" size={18} />}
              <span>Download certificate</span>
            </button>
          </>
        )}

        <Link
          to={`/history/${seminar.id}`}
          aria-label={`View summary for ${seminar.title}`}
          className="inline-flex min-h-11 items-center gap-1 px-space-sm font-body-sm-medium text-body-sm-medium text-primary transition-colors hover:text-maroon-dark"
        >
          <span>View summary</span>
          <Icon name="arrow_forward" size={16} />
        </Link>

        {status === 'evaluation_pending' && (
          <>
            <Link
              to={`/my-seminars/${seminar.id}/evaluation`}
              aria-label={`Complete evaluation for ${seminar.title}`}
              className={actionPrimary}
            >
              <Icon name="rate_review" size={18} />
              <span>Complete evaluation</span>
            </Link>
            <p className="font-caption text-caption text-text-secondary">Required to unlock certificate</p>
          </>
        )}

        {(status === 'below_minimum' || status === 'no_time_out' || status === 'time_out_unvalidated') && (
          <>
            <button
              type="button"
              disabled
              aria-label={`Certificate ineligible for ${seminar.title}`}
              className={actionDisabled}
            >
              <Icon name="lock" size={18} />
              <span>Certificate ineligible</span>
            </button>
            <p className="font-caption text-caption text-text-secondary lg:text-right">{ineligibleReason(record)}</p>
          </>
        )}

        <div role="status" className="max-w-xs empty:hidden lg:text-right">
          {message && <p className="font-caption text-caption text-text-secondary">{message}</p>}
        </div>
      </div>
    </article>
  );
}
