import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionDisabled, actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { formatDayLabel, formatTimeRange } from '../format';
import { getLifecycle, getPrimaryStatus, isFull, slotsLeft } from '../status';
import { TicketTab } from '../tabs/TicketTab';
import { useRegistration } from '../useRegistration';

export default function SeminarDetailsPage() {
  const { id = '' } = useParams();
  const now = useNow(15_000);
  const resource = useResource(() => api.getSeminar(id), `seminar-details-${id}`);
  const loadedItem = resource.state.status === 'success' ? resource.state.data : null;
  const baseItems = useMemo(() => (loadedItem ? [loadedItem] : null), [loadedItem]);
  const registration = useRegistration(baseItems);
  const item = registration.items?.[0] ?? loadedItem;

  useEffect(() => {
    document.title = item ? `${item.seminar.title} - Seminex` : 'Seminar details - Seminex';
  }, [item]);

  useEffect(() => {
    const refresh = () => resource.reload();
    window.addEventListener('seminex:registrations-changed', refresh);
    return () => window.removeEventListener('seminex:registrations-changed', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.reload]);

  if (resource.state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingRegion label="Loading seminar details" className="flex flex-col gap-space-lg">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (resource.state.status === 'error') {
    const notFound = resource.state.code === 'not_found';
    return (
      <PageContainer>
        <StateMessage
          role="alert"
          icon="info"
          title={notFound ? 'Seminar not found' : 'This seminar could not be loaded'}
          action={
            notFound ? (
              <Link to="/seminars" className={actionPrimary}>
                Back to available seminars
              </Link>
            ) : (
              <RetryButton onClick={resource.reload} />
            )
          }
        >
          {errorText(resource.state.code)}
        </StateMessage>
      </PageContainer>
    );
  }

  if (!item) return null;

  if (now === null) {
    return (
      <PageContainer>
        <StateMessage icon="schedule" title="Current seminar time is unavailable">
          Reconnect to check registration availability and seminar status.
        </StateMessage>
      </PageContainer>
    );
  }

  const { seminar, registration: existingRegistration } = item;
  const lifecycle = getLifecycle(seminar, now);
  const status = getPrimaryStatus(item, now);
  const left = slotsLeft(seminar);
  const registered = existingRegistration !== null;
  const isRegisteredAndConfirmed =
    existingRegistration !== null &&
    (existingRegistration.status === 'confirmed' || Boolean(existingRegistration.confirmedAt));
  const canRegister = !registered && lifecycle !== 'finished' && !isFull(seminar);
  const loadingRegistration = registration.pendingId === seminar.id;
  const objectives = seminar.objectives ?? [];
  const dayLabel = formatDayLabel(seminar.startsAt, now);
  const tags = [...new Set([seminar.department, ...seminar.topics])].filter(Boolean);
  const metaRows = [
    { label: 'Required attendance', value: `${seminar.requiredAttendancePercent}% minimum` },
    { label: 'Organizing body', value: seminar.organizingBody ?? 'CCS Student Council' },
    { label: 'Venue guidelines', value: seminar.venueGuidelines },
    { label: 'Speaker bio', value: seminar.speaker.bio },
    { label: 'Certificate eligibility', value: seminar.certificateEligibility },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <PageContainer className="flex flex-col gap-space-lg">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-caption text-caption text-text-secondary">
        <Link to="/seminars" className="hover:text-primary">
          Available seminars
        </Link>
        <Icon name="chevron_right" size={16} />
        <span className="tabular-nums">{seminar.reference}</span>
      </nav>

      {/* Hero: 16:9 Cover + Title, Capacity, and Primary Action */}
      <header className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-sm lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
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
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {seminar.seminarType === 'webinar' && (
                <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption font-medium text-primary">
                  Webinar
                </span>
              )}
              <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
                {seminar.reference}
              </span>
            </div>

            <h1 className="font-headline-lg text-headline-lg-mobile leading-tight text-on-surface md:text-headline-lg">
              {seminar.title}
            </h1>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-surface-container-low px-2.5 py-0.5 font-caption text-caption text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Seat availability + Primary Action bar */}
          <div className="flex flex-col gap-space-sm border-t border-border-subtle pt-space-md">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-body-sm-medium text-body-sm-medium tabular-nums text-on-surface">
                {seminar.registeredCount} of {seminar.capacity} seats taken
              </span>
              <span
                className={cx(
                  'font-caption text-caption font-semibold tabular-nums',
                  left > 0 ? 'text-status-available' : 'text-status-full',
                )}
              >
                {left > 0 ? `${left} ${left === 1 ? 'seat' : 'seats'} left` : 'Fully booked'}
              </span>
            </div>
            <ProgressBar
              value={seminar.registeredCount}
              max={seminar.capacity}
              label={`Capacity: ${seminar.registeredCount} of ${seminar.capacity} seats taken`}
            />

            <div className="mt-1 flex flex-wrap items-center gap-space-sm">
              {registered ? (
                <Link to={`/my-seminars/${seminar.id}?tab=ticket`} className={actionTonal}>
                  <Icon name="open_in_new" size={18} />
                  <span>Open in My seminars</span>
                </Link>
              ) : canRegister ? (
                <button
                  type="button"
                  onClick={() => void registration.register(seminar.id)}
                  aria-disabled={loadingRegistration || registration.pendingId !== null || undefined}
                  className={cx(actionPrimary, (loadingRegistration || registration.pendingId !== null) && 'cursor-wait')}
                >
                  {loadingRegistration ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="how_to_reg" size={18} />
                      <span>Register now</span>
                    </>
                  )}
                </button>
              ) : (
                <button type="button" disabled className={actionDisabled}>
                  <Icon name="lock" size={18} />
                  <span>{lifecycle === 'finished' ? 'Registration closed' : 'Full (closed)'}</span>
                </button>
              )}

              <Link
                to="/guidelines"
                className="inline-flex min-h-10 items-center px-2 font-body-sm-medium text-body-sm-medium text-primary hover:underline"
              >
                Registration guidelines
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Unified Seminar Details Card: metadata strip + description & requirements */}
      <section
        aria-label="Seminar details"
        className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card"
      >
        <dl className="grid grid-cols-1 divide-y divide-border-subtle border-b border-border-subtle tabular-nums sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div className="flex items-center gap-3 p-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Icon name="calendar_today" size={18} />
            </span>
            <div className="min-w-0">
              <dt className="font-caption text-caption text-text-secondary">Date</dt>
              <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">{dayLabel}</dd>
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
              {(seminar.speaker.role || seminar.speaker.organization) && (
                <dd className="truncate font-caption text-caption text-text-secondary">
                  {[seminar.speaker.role, seminar.speaker.organization].filter(Boolean).join(' · ')}
                </dd>
              )}
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

          {objectives.length > 0 && (
            <div className="border-t border-border-subtle pt-space-md">
              <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Learning objectives</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {objectives.map((objective, index) => (
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

          {metaRows.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-2.5 border-t border-border-subtle pt-space-md font-caption text-caption text-text-secondary">
              {metaRows.map((row) => (
                <p key={row.label} className="min-w-0">
                  <span className="font-semibold text-on-surface">{row.label}: </span>
                  {row.value}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Render the live admission ticket & attendance log directly when registered and confirmed */}
      {isRegisteredAndConfirmed && (
        <TicketTab seminar={seminar} registration={existingRegistration} now={now} />
      )}
    </PageContainer>
  );
}
