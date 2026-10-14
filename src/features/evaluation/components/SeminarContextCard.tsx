import type { Ref } from 'react';
import type { SeminarListItem } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';
import { formatClockTime, formatDate } from '../../seminars/format';
import type { HistoryRecord } from '../../history/records';
import { formatQuestionCount } from '../surveyText';

interface SeminarContextCardProps {
  item: SeminarListItem;
  record: HistoryRecord | null;
  /** Shown once the survey is loaded. */
  questionCount?: number;
  headingRef: Ref<HTMLHeadingElement>;
}

/** Seminar details, the student's attendance stamp, and what the evaluation clears. */
export function SeminarContextCard({ item, record, questionCount, headingRef }: SeminarContextCardProps) {
  const { seminar, registration } = item;
  const percent = record?.attendancePercent ?? null;
  const qualified = record?.status === 'ready' || record?.status === 'evaluation_pending';
  const timeIn = registration?.timeIn ? formatClockTime(registration.timeIn.at) : 'Not recorded';
  const timeOut = registration?.timeOut ? formatClockTime(registration.timeOut.at) : 'Not recorded';

  return (
    <section aria-label="Seminar being evaluated" className="relative overflow-hidden rounded-xl bg-surface-card p-space-lg shadow-card">
      <div aria-hidden="true" className="absolute left-0 top-0 h-full w-2 bg-primary-container" />
      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-8">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="inline-flex items-center gap-1 rounded-sm bg-status-finished-container px-2.5 py-0.5 font-caption text-caption font-medium text-status-finished">
              <Icon name="check_circle" size={14} />
              Finished seminar
            </span>
            <span className="font-caption text-caption text-text-secondary">Seminar code: {seminar.reference}</span>
          </div>
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-headline-md text-headline-md tracking-tight text-on-surface outline-offset-4"
            >
              {seminar.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-body-sm text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar_today" size={16} className="text-text-subtle" />
                {formatDate(seminar.startsAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="record_voice_over" size={16} className="text-text-subtle" />
                <span className="sr-only">Speaker: </span>
                {seminar.speaker.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="location_on" size={16} className="text-text-subtle" />
                <span className="sr-only">Venue: </span>
                {seminar.venue}
              </span>
            </p>
          </div>

          <div className="flex flex-col justify-between gap-space-sm rounded-lg bg-surface-container p-space-md sm:flex-row sm:items-center">
            <div className="flex items-center gap-space-sm">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-available-container text-status-available">
                <Icon name="how_to_reg" size={20} />
              </span>
              <div className="flex flex-col">
                <span className="font-body-sm-medium text-body-sm-medium text-on-surface">
                  {percent === null
                    ? 'Attendance not counted'
                    : qualified
                      ? `Attendance verified: ${percent}%`
                      : `Attendance recorded: ${percent}%`}
                </span>
                <span className="font-caption text-caption text-text-secondary">
                  Time-In: {timeIn} {'\u00b7'} Time-Out: {timeOut}
                </span>
              </div>
            </div>
            {qualified && (
              <p className="flex items-center gap-1.5 font-label-sm text-label-sm uppercase text-status-available">
                <Icon name="verified" size={16} />
                Qualified for certificate
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-space-md rounded-lg bg-maroon-container p-space-md lg:col-span-4">
          <div className="flex flex-col gap-space-xs">
            <h2 className="flex items-center gap-space-xs font-title-md text-title-md text-primary">
              <Icon name="workspace_premium" size={20} />
              Certificate clearance
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {record?.status === 'below_minimum'
                ? `Your evaluation is still required, but your attendance is below the ${record.requiredPercent}% minimum, so a certificate will not be issued.`
                : 'Your feedback is required to release your certificate. After you submit, your certificate appears in History when it is ready.'}
            </p>
          </div>
          {questionCount !== undefined && (
            <p className="flex items-center gap-space-xs rounded bg-surface-card/80 p-2 font-caption text-caption text-text-secondary">
              <Icon name="rate_review" size={16} className="text-secondary" />
              {formatQuestionCount(questionCount)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}