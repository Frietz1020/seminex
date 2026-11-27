import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Registration, type Seminar } from '../../../api/client';
import { ticketPdfFilename } from '../../../api/ticketPdf';
import { actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { expireSession } from '../../../session/storage';
import { saveBlob } from '../../history/saveBlob';
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
    let result;
    try {
      result = await api.getTicketPdf(seminar.id);
    } catch {
      setMessage(errorText('network'));
      setDownloading(false);
      return;
    }
    setDownloading(false);
    if (result.ok) {
      saveBlob(result.data, ticketPdfFilename(seminar.reference));
      return;
    }
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    setMessage(
      result.error.code === 'not_available'
        ? 'PDF could not be generated. Use the QR code on the QR ticket tab instead.'
        : errorText(result.error.code),
    );
  }

  const specifications = [
    { label: 'Curriculum credit', value: seminar.curriculumCredit },
    { label: 'Organizing body', value: seminar.organizingBody },
    { label: 'Certificate eligibility', value: seminar.certificateEligibility },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <div className="flex flex-col gap-space-lg">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-caption text-caption text-text-secondary">
        <Link to="/my-seminars" className="hover:text-primary">
          My seminars
        </Link>
        <Icon name="chevron_right" size={16} />
        <span className="tabular-nums">{seminar.reference}</span>
      </nav>

      <header className="flex flex-col gap-space-md sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline-xl text-headline-xl-mobile text-primary md:text-headline-xl">
            {seminar.title}
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-space-xs sm:items-end">
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
            <p role="alert" className="max-w-xs font-caption text-caption text-error sm:text-right">
              {message}
            </p>
          )}
        </div>
      </header>

      <section
        aria-label="Seminar cover"
        className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-sm lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-inverse-surface">
          {seminar.imageUrl ? (
            <img src={seminar.imageUrl} alt={seminar.title} className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-full w-full items-center justify-center">
              <Icon name="event_available" size={56} className="text-white/25" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between gap-space-md p-space-lg md:p-space-xl">
          <div className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={primaryStatus} />
              <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
                {seminar.reference}
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{seminar.title}</h2>
            {seminar.topics.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {seminar.topics.slice(0, 3).map((topic) => (
                  <span key={topic} className="rounded-md bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-text-secondary">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="line-clamp-3 font-body-sm text-body-sm leading-relaxed text-text-secondary">
            {seminar.description}
          </p>
        </div>
      </section>

      {/* Unified Seminar Details Card: key metadata strip + description & requirements */}
      <section
        aria-label="Seminar details"
        className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card"
      >
        <dl className="grid grid-cols-1 divide-y divide-border-subtle border-b border-border-subtle tabular-nums sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="calendar_today" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Date</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">
                <time dateTime={seminar.startsAt}>{formatDate(seminar.startsAt)}</time>
              </dd>
            </div>
          </div>

          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="schedule" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Time</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {formatTimeRange(seminar.startsAt, seminar.endsAt)}
              </dd>
            </div>
          </div>

          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="meeting_room" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Venue</dt>
              <dd className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</dd>
            </div>
          </div>

          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="record_voice_over" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Resource speaker</dt>
              <dd className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.speaker.name}</dd>
              {seminar.speaker.role && (
                <dd className="truncate font-caption text-caption text-text-secondary">{seminar.speaker.role}</dd>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="verified_user" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Required attendance</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-primary">
                {seminar.requiredAttendancePercent}% minimum
              </dd>
              <dd className="truncate font-mono text-caption text-text-subtle">{registration.reference}</dd>
            </div>
          </div>
        </dl>

        <div className="flex flex-col gap-space-md p-space-lg">
          <div>
            <h2 className="font-title-sm text-title-sm text-on-surface">About this seminar</h2>
            <p className="mt-1.5 whitespace-pre-wrap font-body-sm text-body-sm leading-relaxed text-text-secondary">
              {seminar.overview ?? seminar.description}
            </p>
          </div>

          {seminar.objectives && seminar.objectives.length > 0 && (
            <div className="border-t border-border-subtle pt-space-md">
              <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Learning objectives</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {seminar.objectives.map((objective, index) => (
                  <li key={`${index}-${objective}`} className="flex items-start gap-2 font-body-sm text-body-sm text-text-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low font-caption text-caption tabular-nums text-primary">
                      {index + 1}
                    </span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(seminar.venueGuidelines || seminar.speaker.bio || specifications.length > 0) && (
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-subtle pt-space-md font-caption text-caption text-text-secondary">
              {seminar.venueGuidelines && (
                <p className="min-w-0">
                  <span className="font-semibold text-on-surface">Venue guidelines: </span>
                  {seminar.venueGuidelines}
                </p>
              )}
              {seminar.speaker.bio && (
                <p className="min-w-0">
                  <span className="font-semibold text-on-surface">Speaker bio: </span>
                  {seminar.speaker.bio}
                </p>
              )}
              {specifications.map((row) => (
                <p key={row.label} className="min-w-0">
                  <span className="font-semibold text-on-surface">{row.label}: </span>
                  {row.value}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
