import { useState } from 'react';
import { api, type Registration, type Seminar } from '../../../api/client';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Dialog } from '../../../components/ui/Dialog';
import { InlineError, LoadingRegion, RetryButton, Skeleton } from '../../../components/ui/StateMessage';
import { errorText } from '../../../components/ui/errorText';
import { useResource } from '../../../hooks/useResource';
import { useProfile } from '../../../session/ProfileProvider';
import {
  formatClockTime,
  formatDate,
  formatDuration,
  formatFullName,
  programName,
} from '../format';
import { QrCode } from '../QrCode';
import { getAttendance, getLifecycle } from '../status';

const YEAR_ORDINALS = ['1st', '2nd', '3rd', '4th'];

type CheckpointState = 'recorded' | 'pending' | 'missed';

const CHECKPOINT: Record<
  CheckpointState,
  { box: string; text: string; icon: IconName; label: string; tag: string }
> = {
  recorded: {
    box: 'bg-status-available-container',
    text: 'text-status-available',
    icon: 'check_circle',
    label: 'Recorded',
    tag: 'bg-white text-status-available',
  },
  pending: {
    box: 'bg-surface-container-low',
    text: 'text-status-ongoing',
    icon: 'schedule',
    label: 'Pending',
    tag: 'bg-status-ongoing-container text-status-ongoing',
  },
  missed: {
    box: 'bg-status-finished-container',
    text: 'text-status-finished',
    icon: 'info',
    label: 'Not recorded',
    tag: 'bg-white text-status-finished',
  },
};

function checkpointState(recorded: boolean, finished: boolean): CheckpointState {
  return recorded ? 'recorded' : finished ? 'missed' : 'pending';
}

function CheckpointCard({
  title,
  state,
  children,
}: {
  title: string;
  state: CheckpointState;
  children: React.ReactNode;
}) {
  const style = CHECKPOINT[state];
  return (
    <div className={cx('flex flex-col gap-space-xs rounded-lg p-space-md', style.box)}>
      <div className="flex items-center justify-between gap-space-sm">
        <h3 className={cx('flex items-center gap-space-xs font-body-sm-medium text-body-sm-medium', style.text)}>
          <Icon name={style.icon} size={20} />
          <span>{title}</span>
        </h3>
        <span className={cx('rounded-sm px-2 py-0.5 font-label-sm text-label-sm font-semibold uppercase', style.tag)}>
          {style.label}
        </span>
      </div>
      <div className="pl-7 font-body-sm text-body-sm text-on-surface">{children}</div>
    </div>
  );
}

interface TicketTabProps {
  seminar: Seminar;
  registration: Registration;
  now: number;
}

export function TicketTab({ seminar, registration, now }: TicketTabProps) {
  const { state: profileState, reload: reloadProfile } = useProfile();
  const ticket = useResource(() => api.getTicket(seminar.id), `ticket-${seminar.id}`);
  const [qrOpen, setQrOpen] = useState(false);

  const lifecycle = getLifecycle(seminar, now);
  const finished = lifecycle === 'finished';
  const attendance = getAttendance(seminar, registration, now);
  const profile = profileState.status === 'success' ? profileState.data : null;
  const ticketData = ticket.state.status === 'success' ? ticket.state.data : null;
  const fromCache = ticket.state.status === 'success' && ticket.state.fromCache;

  const timeInState = checkpointState(attendance.timeInRecorded, finished);
  const timeOutState = checkpointState(attendance.timeOutRecorded, finished);

  const requirementText = attendance.satisfied
    ? finished
      ? 'Requirement met'
      : 'Currently satisfying'
    : finished
      ? 'Requirement not met'
      : attendance.timeInRecorded
        ? `${formatDuration(attendance.attendedMinutes)} so far`
        : 'No Time-In recorded yet';

  return (
    <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
      <section
        aria-labelledby="ticket-heading"
        className="flex flex-col items-center rounded-xl bg-surface-card p-space-xl shadow-card-hover lg:col-span-7"
      >
        <div className="mb-space-lg flex w-full items-center gap-space-xs border-b border-border-subtle pb-space-md">
          <Icon name="badge" size={20} className="text-primary-container" />
          <h2 id="ticket-heading" className="font-title-md text-title-md text-on-surface">
            Student admission ticket
          </h2>
        </div>

        <div className="mb-space-lg flex w-full flex-col items-start justify-between gap-space-md rounded-lg bg-surface-container-low p-space-md sm:flex-row sm:items-center">
          {profile ? (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="font-caption text-caption text-text-subtle">Student full name</span>
                <span className="font-title-md text-title-md text-on-surface">{formatFullName(profile)}</span>
                <span className="font-body-sm text-body-sm text-text-secondary">
                  {YEAR_ORDINALS[profile.yearLevel - 1] ?? `${profile.yearLevel}th`} year{' '}
                  {programName(profile.program)}
                </span>
              </div>
              <div className="flex flex-col sm:items-end">
                <span className="font-caption text-caption text-text-subtle">Student ID</span>
                <span className="font-mono text-headline-sm font-semibold text-primary">{profile.studentId}</span>
                <span className="font-caption text-caption text-status-available">Registration confirmed</span>
              </div>
            </>
          ) : profileState.status === 'loading' ? (
            <LoadingRegion label="Loading your details" className="w-full">
              <Skeleton className="h-16 w-full" />
            </LoadingRegion>
          ) : (
            <div className="w-full">
              <InlineError onRetry={reloadProfile}>Your details could not be loaded.</InlineError>
            </div>
          )}
        </div>

        {ticket.state.status === 'loading' && (
          <LoadingRegion label="Loading your QR code">
            <Skeleton className="h-60 w-60 max-w-full" />
          </LoadingRegion>
        )}

        {ticket.state.status === 'error' && (
          <div role="alert" className="flex flex-col items-center gap-space-sm py-space-md text-center">
            <p className="max-w-xs font-body-sm text-body-sm text-text-secondary">
              Your QR code could not be loaded. {errorText(ticket.state.code)}
            </p>
            <RetryButton onClick={ticket.reload} />
          </div>
        )}

        {ticketData && (
          <>
            <div className="aspect-square w-full max-w-60 rounded-xl bg-white p-space-md shadow-card [&>div]:block [&>div]:h-full [&>div]:w-full [&_svg]:h-full [&_svg]:w-full">
              <QrCode value={ticketData.token} size={240} label={`QR code ticket for ${seminar.title}`} />
            </div>

            <p className="mt-space-md max-w-sm text-center font-body-sm text-body-sm text-text-secondary">
              Show this QR code to the CCS Student Council marshal at the venue door.
            </p>
            <span className="mt-1 font-mono text-caption text-text-subtle">
              Ticket reference: {registration.reference}
            </span>
            {fromCache && (
              <p role="status" className="mt-space-xs text-center font-caption text-caption text-text-secondary">
                You are offline. Showing your saved ticket. Attendance below may be out of date.
              </p>
            )}
            {finished && (
              <p className="mt-space-xs text-center font-caption text-caption text-text-secondary">
                This seminar has finished, so the ticket is no longer scanned.
              </p>
            )}

            <button type="button" onClick={() => setQrOpen(true)} className={cx(actionTonal, 'mt-space-lg shadow-card')}>
              <Icon name="open_in_full" size={18} />
              <span>Expand for scanning</span>
            </button>
          </>
        )}
      </section>

      <div className="flex flex-col gap-space-lg lg:col-span-5">
        <section
          aria-labelledby="attendance-heading"
          className="flex flex-col gap-space-md rounded-xl bg-surface-card p-space-xl shadow-card"
        >
          <div className="flex items-center justify-between gap-space-sm border-b border-border-subtle pb-space-sm">
            <h2
              id="attendance-heading"
              className="flex items-center gap-space-xs font-title-md text-title-md text-on-surface"
            >
              <Icon name="how_to_reg" size={20} className="text-primary-container" />
              <span>Attendance log</span>
            </h2>
            <span
              className={cx(
                'font-caption text-caption font-medium',
                lifecycle === 'ongoing' ? 'text-status-ongoing' : 'text-text-secondary',
              )}
            >
              {lifecycle === 'ongoing' ? 'Session live' : lifecycle === 'upcoming' ? 'Not started' : 'Session ended'}
            </span>
          </div>

          <p className="font-body-sm text-body-sm text-text-secondary">
            Marshals scan you in and out at the venue. Both scans are required for your certificate.
          </p>

          <div className="flex flex-col gap-space-sm">
            <CheckpointCard title="Time-In (entry)" state={timeInState}>
              {registration.timeIn ? (
                <div className="flex flex-wrap items-center justify-between gap-x-space-md">
                  <span className="font-medium">
                    {formatDate(registration.timeIn.at)} at {formatClockTime(registration.timeIn.at)}
                  </span>
                  {registration.timeIn.station && (
                    <span className="font-caption text-caption text-text-secondary">{registration.timeIn.station}</span>
                  )}
                </div>
              ) : finished ? (
                <p>No Time-In was recorded for this seminar.</p>
              ) : (
                <p className="text-text-secondary">Scan in at the entrance when you arrive.</p>
              )}
            </CheckpointCard>

            <CheckpointCard title="Time-Out (exit)" state={timeOutState}>
              {registration.timeOut ? (
                <div className="flex flex-wrap items-center justify-between gap-x-space-md">
                  <span className="font-medium">
                    {formatDate(registration.timeOut.at)} at {formatClockTime(registration.timeOut.at)}
                  </span>
                  <span className="font-caption text-caption text-text-secondary">
                    {registration.timeOut.validated ? 'Validated by a marshal' : 'Waiting for validation'}
                  </span>
                </div>
              ) : finished ? (
                <p>No Time-Out was recorded for this seminar.</p>
              ) : (
                <p className="text-text-secondary">Scan out when the seminar ends to record your exit.</p>
              )}
            </CheckpointCard>
          </div>

          <div className="mt-space-xs flex flex-col gap-space-xs rounded-lg bg-surface-container p-space-md">
            <div className="flex items-center justify-between gap-space-sm font-body-sm text-body-sm">
              <span className="text-text-secondary">Required attendance</span>
              <span className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {seminar.requiredAttendancePercent}% of the session
              </span>
            </div>
            <ProgressBar
              value={attendance.attendedMinutes}
              max={attendance.requiredMinutes}
              tone="available"
              label="Attendance toward the minimum"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-space-md font-caption text-caption">
              <span className="text-text-secondary">Minimum: {formatDuration(attendance.requiredMinutes)}</span>
              <span
                className={cx(
                  attendance.satisfied ? 'font-medium text-status-available' : 'text-text-secondary',
                )}
              >
                {requirementText}
              </span>
            </div>
          </div>

          <p className="flex items-start gap-space-xs pt-space-xs font-caption text-caption text-text-secondary">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <span>Leaving before the seminar ends will invalidate your attendance and certificate eligibility.</span>
          </p>
        </section>

        <section
          aria-labelledby="help-heading"
          className="flex flex-col gap-space-xs rounded-xl bg-surface-card p-space-lg shadow-card"
        >
          <h2 id="help-heading" className="font-label-sm text-label-sm text-text-subtle">
            Need assistance?
          </h2>
          <p className="font-body-sm text-body-sm text-text-secondary">
            If your QR code does not scan at the entrance, show your student ID card to a CCS Student Council
            officer at the tech desk.
          </p>
        </section>
      </div>

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title="Student admission QR pass">
        <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
          Show this screen to the marshal's scanner.
        </p>
        {ticketData && (
          <div className="mx-auto my-space-lg aspect-square w-full max-w-[300px] rounded-xl border border-border-subtle bg-white p-space-sm [&>div]:block [&>div]:h-full [&>div]:w-full [&_svg]:h-full [&_svg]:w-full">
            <QrCode value={ticketData.token} size={300} label={`Large QR code ticket for ${seminar.title}`} />
          </div>
        )}
        {profile && (
          <div className="text-center">
            <p className="font-title-md text-title-md text-on-surface">{formatFullName(profile)}</p>
            <p className="font-mono text-body-sm-medium text-primary">{profile.studentId}</p>
          </div>
        )}
        <button type="button" onClick={() => setQrOpen(false)} className={cx(actionPrimary, 'mt-space-lg w-full')}>
          Close
        </button>
      </Dialog>
    </div>
  );
}