import { Link } from 'react-router-dom';
import type { Seminar, SeminarListItem } from '../../../api/types';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import { Menu } from '../../../components/ui/Menu';
import { StatusBadge, type BadgeStatus } from '../../../components/ui/StatusBadge';
import type { MySeminarGroup } from '../../../lib/seminarStatus';
import { formatClockTime, formatDate, formatDayLabel, formatTimeRange } from '../format';
import { getLifecycle } from '../status';

interface MySeminarCardProps {
  item: SeminarListItem;
  group: MySeminarGroup;
  now: number;
  /** Opens the cancel confirmation. Only upcoming seminars offer it. */
  onCancel: (seminar: Seminar) => void;
}

/** Cover image, or a plain illustration while seminars have no image. The caption names the venue. */
function Cover({ seminar }: { seminar: Seminar }) {
  return (
    <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-lg bg-surface-container md:w-56">
      {seminar.imageUrl ? (
        <img src={seminar.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
          <rect width="200" height="130" className="fill-surface-container" />
          <circle cx="50" cy="35" r="14" className="fill-secondary-fixed" />
          <path d="M0 100 L60 50 L110 90 L160 40 L200 70 L200 130 L0 130 Z" className="fill-surface-variant" />
          <path d="M0 118 L70 78 L130 110 L200 84 L200 130 L0 130 Z" className="fill-outline-variant" />
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-inverse-surface/80 to-transparent px-2.5 pb-2 pt-8">
        <span className="font-caption text-caption text-white">{seminar.venue}</span>
      </div>
    </div>
  );
}

function Detail({ icon, label, children }: { icon: IconName; label: string; children: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">{label}</dt>
      <Icon name={icon} size={18} className="text-text-subtle" />
      <dd>{children}</dd>
    </div>
  );
}

export function MySeminarCard({ item, group, now, onCancel }: MySeminarCardProps) {
  const { seminar, registration } = item;
  if (!registration) return null;

  const titleId = `my-seminar-${seminar.id}`;
  const finished = getLifecycle(seminar, now) === 'finished';
  const phase: BadgeStatus = finished ? 'finished' : group === 'upcoming' ? 'upcoming' : 'ongoing';
  const whenText = finished
    ? `Finished ${formatDate(seminar.endsAt)} at ${formatClockTime(seminar.endsAt)}`
    : `${formatDayLabel(seminar.startsAt, now)}, ${formatTimeRange(seminar.startsAt, seminar.endsAt)}`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-space-lg rounded-xl bg-surface-card p-space-lg shadow-card transition-shadow hover:shadow-card-hover md:flex-row"
    >
      <Cover seminar={seminar} />

      <div className="flex min-w-0 flex-1 flex-col gap-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <StatusBadge status={phase} shape="pill" />
            <StatusBadge status="registered" shape="pill" />
          </div>
          {group === 'upcoming' && (
            <div className="-mr-2 -mt-2">
              <Menu
                label={`More options for ${seminar.title}`}
                items={[{ id: 'cancel', label: 'Cancel registration', icon: 'event_busy', onSelect: () => onCancel(seminar) }]}
              />
            </div>
          )}
        </div>

        <h3 id={titleId} className="font-headline-sm text-headline-sm text-on-surface">
          <Link to={`/my-seminars/${seminar.id}`} className="hover:text-primary hover:underline">
            {seminar.title}
          </Link>
        </h3>

        <dl className="grid grid-cols-1 gap-space-sm font-body-sm text-body-sm text-text-secondary sm:grid-cols-2">
          <Detail icon="person" label="Speaker">
            {seminar.speaker.name}
          </Detail>
          <Detail icon="location_on" label="Venue">
            {seminar.venue}
          </Detail>
          <Detail icon={finished ? 'event_available' : 'calendar_today'} label={finished ? 'Finished' : 'Date and time'}>
            {whenText}
          </Detail>
        </dl>

        {group === 'ongoing' && (
          <div className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-primary">
            <p className="flex items-center gap-1.5">
              <Icon name={registration.timeIn ? 'done_all' : 'schedule'} size={18} />
              {registration.timeIn
                ? `Time-In recorded ${formatClockTime(registration.timeIn.at)}`
                : 'Time-In not recorded yet. Show your QR code at the entrance.'}
            </p>
            {finished && (
              <p className="flex items-center gap-1.5">
                <Icon name={registration.timeOut ? 'done_all' : 'schedule'} size={18} />
                {registration.timeOut
                  ? `Time-Out recorded ${formatClockTime(registration.timeOut.at)}`
                  : 'Time-Out not recorded yet. Show your QR code at the exit.'}
              </p>
            )}
          </div>
        )}

        {group === 'evaluation' && (
          <p className="font-body-sm text-body-sm text-text-secondary">
            Answer the evaluation to qualify for your certificate.
          </p>
        )}

        <div className="mt-auto flex justify-end border-t border-border-subtle pt-space-md">
          {group === 'evaluation' ? (
            <Link to={`/my-seminars/${seminar.id}/evaluation`} className={cx(actionPrimary, 'w-full sm:w-auto')}>
              <Icon name="rate_review" size={18} />
              <span>Answer evaluation</span>
            </Link>
          ) : (
            <Link to={`/my-seminars/${seminar.id}?tab=ticket`} className={cx(actionPrimary, 'w-full sm:w-auto')}>
              <Icon name="qr_code_2" size={18} />
              <span>View QR code</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}