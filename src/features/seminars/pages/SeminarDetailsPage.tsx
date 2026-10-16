import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionDisabled, actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { IconName } from '../../../components/ui/icons';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { useRegistration } from '../useRegistration';
import { formatDayLabel, formatTimeRange } from '../format';
import { getLifecycle, getPrimaryStatus, isFull, slotsLeft } from '../status';

function initials(name: string): string {
  return name
    .replace(/^(dr|prof|engr|mr|ms|mrs|atty)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-title-md text-title-md text-on-surface">
      <span aria-hidden="true" className="h-5 w-1.5 rounded-full bg-primary-container" />
      {children}
    </h2>
  );
}

export default function SeminarDetailsPage() {
  const { id = '' } = useParams();
  const now = useNow();
  const resource = useResource(() => api.getSeminar(id), `seminar-details-${id}`);
  const loadedItem = resource.state.status === 'success' ? resource.state.data : null;
  const baseItems = useMemo(() => (loadedItem ? [loadedItem] : null), [loadedItem]);
  const registration = useRegistration(baseItems);
  const item = registration.items?.[0] ?? (resource.state.status === 'success' ? resource.state.data : null);

  useEffect(() => {
    document.title = item ? `${item.seminar.title} - Seminex` : 'Seminar details - Seminex';
  }, [item]);

  if (resource.state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingRegion label="Loading seminar details" className="flex flex-col gap-space-lg">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
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
          action={notFound ? <Link to="/seminars" className={actionPrimary}>Back to available seminars</Link> : <RetryButton onClick={resource.reload} />}
        >
          {errorText(resource.state.code)}
        </StateMessage>
      </PageContainer>
    );
  }

  if (!item) return null;

  const { seminar, registration: existingRegistration } = item;
  const lifecycle = getLifecycle(seminar, now);
  const status = getPrimaryStatus(item, now);
  const left = slotsLeft(seminar);
  const registered = existingRegistration !== null;
  const canRegister = !registered && lifecycle !== 'finished' && !isFull(seminar);
  const loadingRegistration = registration.pendingId === seminar.id;
  const objectives = seminar.objectives ?? [];
  const requirements = [
    `Attend at least ${seminar.requiredAttendancePercent}% of the seminar.`,
    'Have your Time-In and Time-Out recorded and validated.',
    'Submit the evaluation after the seminar finishes.',
  ];
  const dayLabel = formatDayLabel(seminar.startsAt, now);
  const tags = [...new Set([seminar.department, ...seminar.topics])];

  return (
    <PageContainer>
      <div className="mb-1">
        <Link
          to={registered ? '/my-seminars' : '/seminars'}
          className="inline-flex min-h-11 items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-primary transition-colors hover:text-maroon-dark"
        >
          <Icon name="arrow_back" size={18} />
          <span>{registered ? 'My seminars' : 'Available seminars'}</span>
        </Link>
      </div>

      <div className="mb-6 h-48 overflow-hidden rounded-xl border border-border-subtle bg-surface-container-high shadow-card sm:h-64 lg:h-80">
        {seminar.imageUrl ? (
          <img src={seminar.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-primary-container via-maroon-dark to-inverse-surface">
            <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_80%,#ffb3ad_0,transparent_42%)]" />
            <div className="relative flex flex-col items-center gap-3 text-white/90">
              <Icon name="school" size={32} />
              <span className="font-label-sm text-label-sm uppercase tracking-[0.2em]">CCS Seminar</span>
            </div>
          </div>
        )}
      </div>

      <header className="mb-7">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusBadge status={status} />
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-card px-2.5 py-1 font-caption text-caption text-text-secondary">
            <Icon name="badge" size={14} className="text-text-subtle" />
            {seminar.reference}
          </span>
        </div>
        <h1 className="mb-4 font-headline-lg text-headline-lg-mobile leading-tight tracking-tight text-on-surface md:text-headline-lg">
          {seminar.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-container px-3 py-1 font-caption text-caption font-medium text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
        <FactCard icon="event" label="Date and time">
          <p className="font-body-sm-medium text-body-sm-medium text-on-surface">{dayLabel}</p>
          <p className="mt-0.5 font-caption text-caption text-text-secondary">{formatTimeRange(seminar.startsAt, seminar.endsAt)}</p>
        </FactCard>
        <FactCard icon="location_on" label="Venue">
          <p className="font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</p>
          <p className="mt-0.5 font-caption text-caption text-text-secondary">{seminar.speaker.organization ?? seminar.department}</p>
        </FactCard>
        <FactCard icon="group" label="Seats">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.registeredCount} of {seminar.capacity} seats taken</span>
            <span className="font-caption text-caption font-semibold text-secondary-accent">{left} {left === 1 ? 'seat' : 'seats'} left</span>
          </div>
          <ProgressBar value={seminar.registeredCount} max={seminar.capacity} label={`Capacity: ${seminar.registeredCount} of ${seminar.capacity} seats taken`} />
        </FactCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card md:p-7">
            <SectionTitle>Overview</SectionTitle>
            <div className="space-y-3.5 font-body-sm text-body-sm leading-relaxed text-text-secondary md:text-body-base">
              <p>{seminar.overview ?? seminar.description}</p>
            </div>
          </section>

          {objectives.length > 0 && (
            <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card md:p-7">
              <SectionTitle>Key learning objectives</SectionTitle>
              <ul className="space-y-3 font-body-sm text-body-sm text-text-secondary md:text-body-base">
                {objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-3">
                    <Icon name="check_circle" size={20} className="mt-0.5 shrink-0 text-primary" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card md:p-7">
            <SectionTitle>Resource speaker</SectionTitle>
            <div className="flex items-start gap-4 md:gap-5">
              {seminar.speaker.photoUrl ? (
                <img src={seminar.speaker.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover md:h-16 md:w-16" />
              ) : (
                <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-container font-headline-md text-headline-md text-white shadow-card md:h-16 md:w-16">
                  {initials(seminar.speaker.name)}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="font-title-md text-title-md text-on-surface">{seminar.speaker.name}</h3>
                <p className="mt-0.5 font-body-sm-medium text-body-sm-medium text-primary">{seminar.speaker.role}</p>
                {seminar.speaker.organization && <p className="mb-3 font-caption text-caption text-text-subtle">{seminar.speaker.organization}</p>}
                {seminar.speaker.bio && <p className="font-body-sm text-body-sm leading-relaxed text-text-secondary">{seminar.speaker.bio}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card md:p-7">
            <SectionTitle>Venue guidelines</SectionTitle>
            <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-light p-4 font-body-sm text-body-sm text-text-secondary">
              <Icon name="info" size={22} className="mt-0.5 shrink-0 text-primary" />
              <p className="leading-relaxed">{seminar.venueGuidelines ?? 'Arrive early and keep your QR ticket ready at the entrance.'}</p>
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card md:p-7">
            <SectionTitle>Certificate requirements</SectionTitle>
            {seminar.certificateEligibility && (
              <p className="mb-4 font-body-sm text-body-sm text-text-secondary">{seminar.certificateEligibility}</p>
            )}
            <ol className="space-y-3.5 font-body-sm text-body-sm text-text-secondary">
              {requirements.map((requirement, index) => (
                <li key={requirement} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-maroon-container font-label-sm text-label-sm text-primary">{index + 1}</span>
                  <span>{requirement}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card">
            <div>
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-text-subtle">Organizing body</p>
              <p className="mt-0.5 font-title-md text-title-md text-on-surface">{seminar.organizingBody ?? 'CCS Student Council'}</p>
            </div>
            <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-text-secondary">
              <Icon name="group" size={20} />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:col-span-4">
          <section aria-label="Seminar registration" className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card-hover md:p-6">
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.registeredCount} of {seminar.capacity} seats taken</span>
                <span className="font-body-sm-medium text-body-sm-medium text-secondary-accent">{left} left</span>
              </div>
              <ProgressBar value={seminar.registeredCount} max={seminar.capacity} label={`Capacity: ${seminar.registeredCount} of ${seminar.capacity} seats taken`} />
            </div>
            {registered ? (
              <Link to={`/my-seminars/${seminar.id}?tab=ticket`} className={`${actionPrimary} w-full`}>
                <Icon name="confirmation_number" size={20} />
                View ticket
              </Link>
            ) : canRegister ? (
              <button
                type="button"
                onClick={() => void registration.register(seminar.id)}
                aria-disabled={loadingRegistration || registration.pendingId !== null || undefined}
                className={`${actionPrimary} w-full ${(loadingRegistration || registration.pendingId !== null) ? 'cursor-wait' : ''}`}
              >
                {loadingRegistration ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Registering...</> : <><Icon name="how_to_reg" size={20} />Register</>}
              </button>
            ) : (
              <button type="button" disabled className={`${actionDisabled} w-full`}>
                <Icon name="lock" size={18} />
                {lifecycle === 'finished' ? 'Registration closed' : 'Full (closed)'}
              </button>
            )}
            <div className="mt-4 text-center">
              <Link to="/guidelines" className={`${actionTonal} min-h-0 bg-transparent px-2 py-1 text-primary underline decoration-transparent underline-offset-4 hover:bg-transparent hover:decoration-current`}>
                Registration guidelines
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}

function FactCard({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <section className="flex min-h-[104px] items-start gap-4 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card">
      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-container text-primary">
        <Icon name={icon} size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="mb-1 font-label-sm text-label-sm uppercase tracking-wider text-text-subtle">{label}</h2>
        {children}
      </div>
    </section>
  );
}
