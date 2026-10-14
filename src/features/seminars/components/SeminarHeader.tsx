import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Registration, type Seminar } from '../../../api/client';
import { actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { expireSession } from '../../../session/storage';
import { formatDate, formatTimeRange } from '../format';
import type { SeminarStatus } from '../status';

interface SeminarHeaderProps {
  seminar: Seminar;
  registration: Registration;
  primaryStatus: Exclude<SeminarStatus, 'registered'>;
}

export function SeminarHeader({ seminar, registration, primaryStatus }: SeminarHeaderProps) {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDownload() {
    if (downloading) return;
    setMessage(null);
    setDownloading(true);
    const result = await api.getTicketPdf(seminar.id);
    setDownloading(false);
    if (result.ok) return; // No success path yet: getTicketPdf has no real implementation.
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    setMessage(
      result.error.code === 'not_available'
        ? 'The ticket PDF is not available yet. Use the QR code on the QR ticket tab instead.'
        : errorText(result.error.code),
    );
  }

  return (
    <header className="flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Link
          to="/my-seminars"
          className="inline-flex min-h-11 items-center gap-space-xs font-body-sm-medium text-body-sm-medium text-text-secondary transition-colors hover:text-primary"
        >
          <Icon name="arrow_back" size={18} />
          <span>Back to my seminars</span>
        </Link>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-space-xs font-caption text-caption text-text-secondary">
            <li>
              <Link to="/my-seminars" className="underline-offset-2 hover:underline">
                My seminars
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{seminar.reference}</li>
          </ol>
        </nav>
      </div>

      <div className="relative flex flex-col justify-between gap-space-lg overflow-hidden rounded-xl bg-surface-card p-space-xl shadow-card md:flex-row md:items-start">
        <div aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-1.5 bg-primary-container" />

        <div className="flex min-w-0 flex-col gap-space-sm pl-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <StatusBadge status={primaryStatus} />
            <span className="font-caption text-caption text-text-secondary">
              Registration reference: {registration.reference}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile tracking-tight text-on-surface md:text-headline-lg">
            {seminar.title}
          </h1>
          <ul className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 font-body-sm text-body-sm text-text-secondary">
            <li className="flex items-center gap-1.5">
              <Icon name="calendar_today" size={18} className="text-text-subtle" />
              <time dateTime={seminar.startsAt}>{formatDate(seminar.startsAt)}</time>
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="schedule" size={18} className="text-text-subtle" />
              <span>{formatTimeRange(seminar.startsAt, seminar.endsAt)}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="meeting_room" size={18} className="text-text-subtle" />
              <span>{seminar.venue}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="record_voice_over" size={18} className="text-text-subtle" />
              <span>Speaker: {seminar.speaker.name}</span>
            </li>
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-space-xs md:items-end">
          <button
            type="button"
            onClick={handleDownload}
            aria-disabled={downloading || undefined}
            className={cx(actionTonal, downloading && 'cursor-wait')}
          >
            {downloading ? (
              <>
                <Spinner />
                <span>Preparing PDF...</span>
              </>
            ) : (
              <>
                <Icon name="download" size={18} />
                <span>Download PDF</span>
              </>
            )}
          </button>
          {message && (
            <p role="alert" className="max-w-xs font-caption text-caption text-error md:text-right">
              {message}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}