import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SeminarListItem } from '../../../api/types';
import { actionDisabled, actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Spinner } from '../../../components/ui/Spinner';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatDate, formatDayLabel, formatSlots, formatTimeRange } from '../format';
import { getLifecycle, getPrimaryStatus, isFull, isRegistered } from '../status';

interface SeminarCardProps {
  item: SeminarListItem;
  now: number;
  /** "compact" is the Home grid card; "detailed" is the Available Seminars card. */
  variant: 'compact' | 'detailed';
  /** Heading level for the title, which depends on the page's outline. */
  titleAs?: 'h2' | 'h3';
  /** This card's registration is in progress. */
  registering?: boolean;
  /** Another registration is in progress, so actions are locked. */
  locked?: boolean;
  onRegister: (seminarId: string) => void;
}

const CAPACITY_TONE = { ongoing: 'ongoing', full: 'full', available: 'available', finished: 'full' } as const;

export function SeminarCard({
  item,
  now,
  variant,
  titleAs = 'h3',
  registering = false,
  locked = false,
  onRegister,
}: SeminarCardProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const { seminar } = item;
  const detailed = variant === 'detailed';
  const Title = titleAs;
  const primary = getPrimaryStatus(item, now);
  const lifecycle = getLifecycle(seminar, now);
  const registered = isRegistered(item);
  const full = isFull(seminar);
  const finished = lifecycle === 'finished';
  const reasonId = `reason-${seminar.id}`;
  const descriptionId = `description-${seminar.id}`;
  const slotsText = formatSlots(seminar, detailed);

  const closedReason = finished
    ? 'This seminar has finished.'
    : full
      ? `All ${seminar.capacity} seats are registered.`
      : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-card transition-shadow hover:shadow-card-hover">
      <div className={cx('relative w-full overflow-hidden bg-maroon-container', detailed ? 'h-48' : 'h-44')}>
        {seminar.imageUrl ? (
          <>
            <img
              src={seminar.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-inverse-surface/80 via-transparent to-transparent" />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-primary-container"
          >
            <Icon name="event_available" size={32} />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <StatusBadge status={primary} elevated />
        </div>
        {registered && (
          <div className="absolute right-3 top-3">
            <StatusBadge status="registered" elevated />
          </div>
        )}

        {!detailed && (
          <div className="absolute bottom-3 left-3 rounded-md bg-surface-card/90 px-2.5 py-1 font-caption text-caption text-on-surface shadow-card backdrop-blur-md">
            <time dateTime={seminar.startsAt}>{formatDate(seminar.startsAt)}</time>
          </div>
        )}
        <div className="absolute bottom-3 right-3 rounded-md bg-surface-card/90 px-2 py-0.5 font-caption text-caption font-medium text-on-surface shadow-card backdrop-blur-md">
          {slotsText}
        </div>
      </div>

      <div className={cx('flex flex-1 flex-col', detailed ? 'gap-space-md p-space-lg' : 'gap-space-sm p-space-md')}>
        {detailed ? (
          <div className="flex flex-col gap-space-xs">
            <p
              className={cx(
                'flex items-center gap-1.5 font-caption text-caption',
                lifecycle === 'ongoing' ? 'font-medium text-secondary-accent' : 'text-text-secondary',
              )}
            >
              <Icon
                name={lifecycle === 'ongoing' ? 'timelapse' : 'schedule'}
                size={16}
                className={lifecycle === 'ongoing' ? 'text-secondary-accent' : 'text-text-subtle'}
              />
              <span>
                {formatDayLabel(seminar.startsAt, now)}, {formatTimeRange(seminar.startsAt, seminar.endsAt)}
              </span>
            </p>
            <p className="flex items-center gap-1.5 font-caption text-caption text-text-secondary">
              <Icon name="location_on" size={16} className="text-text-subtle" />
              <span className="truncate">{seminar.venue}</span>
            </p>

            <Title className="mt-1 line-clamp-2 font-title-md text-title-md text-on-surface">
              <Link to={`/seminars/${seminar.id}`} className="hover:text-primary hover:underline">
                {seminar.title}
              </Link>
            </Title>

            <p className="mt-1 flex flex-wrap items-center gap-x-2">
              <Icon name="badge" size={18} className="text-primary" />
              <span className="font-body-sm-medium text-body-sm-medium text-primary">{seminar.speaker.name}</span>
              <span className="sr-only">, </span>
              <span className="font-caption text-caption text-text-subtle">{seminar.speaker.role}</span>
            </p>
            <p id={descriptionId} className={cx('mt-2 font-body-sm text-body-sm leading-relaxed text-text-secondary', !descriptionExpanded && 'line-clamp-3')}>
              {seminar.description}
            </p>
            {seminar.description.length > 140 && (
              <button
                type="button"
                aria-expanded={descriptionExpanded}
                aria-controls={descriptionId}
                onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                className="mt-1 min-h-10 self-start rounded-md font-body-sm-medium text-body-sm-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {descriptionExpanded ? 'See less' : 'See more'}
              </button>
            )}
          </div>
        ) : (
          <>
            <Title className="line-clamp-2 font-title-md text-title-md text-on-surface">
              <Link to={`/seminars/${seminar.id}`} className="hover:text-primary hover:underline">
                {seminar.title}
              </Link>
            </Title>
            <div className="flex flex-col gap-1.5 font-body-sm text-body-sm text-text-secondary">
              <p className="flex items-center gap-2">
                <Icon name="schedule" size={16} className="text-text-subtle" />
                <span>{formatTimeRange(seminar.startsAt, seminar.endsAt)}</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="location_on" size={16} className="text-text-subtle" />
                <span>{seminar.venue}</span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="person" size={16} className="text-text-subtle" />
                <span className="truncate">Speaker: {seminar.speaker.name}</span>
              </p>
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-space-sm pt-space-xs">
          {detailed && (
            <ProgressBar
              value={seminar.registeredCount}
              max={seminar.capacity}
              tone={CAPACITY_TONE[primary]}
              label={`Capacity: ${seminar.registeredCount} of ${seminar.capacity} registered`}
            />
          )}

          {registered ? (
            <Link to={`/my-seminars/${seminar.id}?tab=ticket`} className={cx(actionTonal, 'w-full')}>
              <Icon name="confirmation_number" size={18} className="text-primary" />
              <span>View ticket</span>
            </Link>
          ) : closedReason ? (
            <>
              <button
                type="button"
                disabled
                aria-describedby={reasonId}
                className={cx(actionDisabled, 'w-full')}
              >
                <Icon name="lock" size={18} />
                <span>{finished ? 'Registration closed' : 'Full (closed)'}</span>
              </button>
              <p id={reasonId} className="text-center font-caption text-caption text-text-secondary">
                {closedReason}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onRegister(seminar.id)}
              aria-disabled={registering || locked || undefined}
              className={cx(actionPrimary, 'w-full active:scale-[0.99]', (registering || locked) && 'cursor-wait')}
            >
              {registering ? (
                <>
                  <Spinner />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Icon name="check_circle" size={18} />
                  <span>Register now</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
