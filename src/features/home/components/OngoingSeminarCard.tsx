import { Link } from 'react-router-dom';
import { api, type Registration, type Seminar } from '../../../api/client';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Skeleton } from '../../../components/ui/StateMessage';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useResource } from '../../../hooks/useResource';
import { formatClockTime, formatDuration, formatStarted, formatTimeRange } from '../../seminars/format';
import { QrCode } from '../../seminars/QrCode';
import { getAttendance } from '../../seminars/status';

interface OngoingSeminarCardProps {
  seminar: Seminar;
  registration: Registration;
  now: number;
}

export function OngoingSeminarCard({ seminar, registration, now }: OngoingSeminarCardProps) {
  const ticket = useResource(() => api.getTicket(seminar.id), `ticket-${seminar.id}`);
  const attendance = getAttendance(seminar, registration, now);

  return (
    <section
      aria-labelledby={`ongoing-${seminar.id}`}
      className="flex w-full flex-col justify-between gap-space-xl rounded-xl bg-surface-card p-space-lg shadow-card lg:flex-row"
    >
      <div className="flex flex-1 flex-col justify-between gap-space-lg">
        <div className="flex flex-col gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <StatusBadge status="ongoing" shape="pill" />
            <StatusBadge status="registered" shape="pill" />
          </div>
          <h2 id={`ongoing-${seminar.id}`} className="mt-1 font-headline-md text-headline-md text-on-surface">
            {seminar.title}
          </h2>
          <p className="flex items-center gap-2 font-body-base text-body-base text-text-secondary">
            <Icon name="person" size={18} className="text-primary-container" />
            <span>
              {seminar.speaker.name} ({seminar.speaker.role})
            </span>
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-space-md py-space-sm sm:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <Icon name="location_on" size={20} className="text-text-subtle" />
            <div className="flex flex-col">
              <dt className="font-caption text-caption text-text-subtle">Venue</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Icon name="schedule" size={20} className="text-text-subtle" />
            <div className="flex flex-col">
              <dt className="font-caption text-caption text-text-subtle">Schedule</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {formatTimeRange(seminar.startsAt, seminar.endsAt)}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Icon name="group" size={20} className="text-text-subtle" />
            <div className="flex flex-col">
              <dt className="font-caption text-caption text-text-subtle">Capacity</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {seminar.registeredCount} of {seminar.capacity} attendees
              </dd>
            </div>
          </div>
        </dl>

        <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-md">
          <div className="flex flex-wrap items-center justify-between gap-x-space-md gap-y-1">
            {registration.timeIn ? (
              <p className="flex items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-on-surface">
                <Icon name="check" size={16} className="text-status-available" />
                Time-In recorded at {formatClockTime(registration.timeIn.at)}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-on-surface">
                <Icon name="schedule" size={16} className="text-status-ongoing" />
                Time-In not recorded yet. Show your QR code at the entrance.
              </p>
            )}
            <span className="font-caption text-caption text-text-secondary">
              {formatStarted(seminar.startsAt, now)}
            </span>
          </div>

          <ProgressBar
            value={attendance.attendedMinutes}
            max={attendance.requiredMinutes}
            label="Attendance toward the minimum"
          />
          <p className="font-caption text-caption text-text-secondary">
            {formatDuration(attendance.attendedMinutes)} of {formatDuration(attendance.requiredMinutes)} minimum
            {attendance.satisfied && (
              <span className="ml-2 font-medium text-status-available">Minimum attendance reached</span>
            )}
          </p>
          <p className="font-caption text-caption text-text-subtle">
            {registration.timeOut
              ? `Time-Out recorded at ${formatClockTime(registration.timeOut.at)}`
              : 'Time-Out: pending exit scan'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center gap-space-md rounded-lg bg-surface-container-low p-space-md text-center lg:w-72">
        <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-white shadow-card">
          {ticket.state.status === 'success' ? (
            <QrCode
              value={ticket.state.data.token}
              size={128}
              label={`QR code ticket for ${seminar.title}`}
            />
          ) : ticket.state.status === 'loading' ? (
            <div role="status">
              <span className="sr-only">Loading your QR code</span>
              <Skeleton className="h-28 w-28" />
            </div>
          ) : (
            <div role="alert" className="flex flex-col items-center px-2">
              <p className="font-caption text-caption text-text-secondary">QR code unavailable</p>
              <button
                type="button"
                onClick={ticket.reload}
                className="inline-flex min-h-11 items-center font-caption text-caption font-semibold text-primary underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-1">
          <Link to={`/my-seminars/${seminar.id}?tab=ticket`} className={cx(actionPrimary, 'w-full')}>
            <Icon name="qr_code" size={18} />
            <span>View QR code</span>
          </Link>
          <span className="font-caption text-caption text-text-subtle">
            {ticket.state.status === 'success' && ticket.state.fromCache
              ? 'Showing your saved ticket.'
              : 'Show this code at the exit to record your Time-Out.'}
          </span>
        </div>
      </div>
    </section>
  );
}