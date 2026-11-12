import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { SeminarHeader } from '../components/SeminarHeader';
import { getDefaultTab, getEvaluationAccess, isSeminarTab, type SeminarTab } from '../seminarTabs';
import { getPrimaryStatus } from '../status';
import { DetailsTab } from '../tabs/DetailsTab';
import { EvaluationTab } from '../tabs/EvaluationTab';
import { TicketTab } from '../tabs/TicketTab';
import { actionTonal } from '../../../components/ui/actionStyles';

export default function SeminarPage() {
  const { id = '' } = useParams();
  const now = useNow(1000);
  const [params, setParams] = useSearchParams();
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const requested = params.get('tab');

  const seminar = useResource(() => api.getSeminar(id), `seminar-${id}`);
  const item = seminar.state.status === 'success' ? seminar.state.data : null;

  useEffect(() => {
    document.title = item ? `${item.seminar.title} - Seminex` : 'Seminar - Seminex';
  }, [item]);

  const defaultTab: SeminarTab | null = item && now !== null ? getDefaultTab(item, now) : null;
  const selected: SeminarTab = item?.registration?.status === 'released' ? 'details' : isSeminarTab(requested) ? requested : (defaultTab ?? 'details');

  // Pin the default tab into the address so a reload or shared link opens the same tab.
  const itemId = item?.seminar.id;
  useEffect(() => {
    if (itemId && !isSeminarTab(requested) && defaultTab) {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', defaultTab);
        return next;
      }, { replace: true });
    }
    // Only when the seminar first loads or the address loses its tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, requested]);

  function selectTab(tabId: string) {
    if (!isSeminarTab(tabId)) return;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', tabId);
      return next;
    }, { replace: true });
  }

  if (seminar.state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingRegion label="Loading seminar" className="flex flex-col gap-space-lg">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-11 w-96 max-w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (seminar.state.status === 'error') {
    const notFound = seminar.state.code === 'not_found';
    return (
      <PageContainer>
        <StateMessage
          role="alert"
          icon="info"
          title={notFound ? 'Seminar not found' : 'This seminar could not be loaded'}
          action={
            notFound ? (
              <Link to="/my-seminars" className={actionPrimary}>
                Back to my seminars
              </Link>
            ) : (
              <RetryButton onClick={seminar.reload} />
            )
          }
        >
          {errorText(seminar.state.code)}
        </StateMessage>
      </PageContainer>
    );
  }

  if (!item || !item.registration) {
    return (
      <PageContainer>
        <StateMessage
          icon="event_available"
          title="You are not registered for this seminar"
          action={
            <Link to="/seminars" className={actionPrimary}>
              Browse available seminars
            </Link>
          }
        >
          Register from the available seminars to get your ticket.
        </StateMessage>
      </PageContainer>
    );
  }

  if (now === null) {
    return <PageContainer><StateMessage icon="schedule" title="Current seminar time is unavailable">Reconnect to check attendance and evaluation eligibility.</StateMessage></PageContainer>;
  }

  const { seminar: details, registration } = item;
  const opensAt = Date.parse(details.startsAt) - (details.confirmationOpensHoursBefore ?? 24) * 60 * 60_000;
  const closesAt = Date.parse(details.startsAt) - (details.confirmationClosesHoursBefore ?? 1) * 60 * 60_000;
  const confirmationOpen = now >= opensAt && now < closesAt;
  const countdown = (target: number) => {
    const seconds = Math.max(0, Math.floor((target - now) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return `${hours}h ${minutes}m ${remainder}s`;
  };
  const released = registration.status === 'released';
  async function confirmAttendance() {
    if (confirmPending) return;
    setConfirmPending(true);
    const result = await api.confirmRegistration(details.id);
    setConfirmPending(false);
    if (result.ok) { setConfirmMessage('Your place is confirmed.'); seminar.reload(); }
    else setConfirmMessage(result.error.code === 'network' ? 'Connect to the internet to confirm your place.' : errorText(result.error.code));
  }
  const access = getEvaluationAccess(item, now);
  const locked = access.state === 'locked';
  const tabs: TabItem[] = [
    { id: 'details', label: 'Details', icon: 'info' },
    ...(registration.status === 'released' ? [] : [{ id: 'ticket', label: 'Attendance & ticket', icon: 'how_to_reg' as const }]),
    {
      id: 'evaluation',
      label: 'Evaluation',
      icon: locked ? 'lock' : 'rate_review',
      status: locked ? 'Locked' : undefined,
    },
  ];

  return (
    <PageContainer>
      <SeminarHeader seminar={details} registration={registration} primaryStatus={getPrimaryStatus(item, now)} />

      {released && <p role="status" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">Your registration was released because it was not confirmed before the confirmation window closed. Your ticket is no longer valid.</p>}
      {!released && registration.status === 'registered' && <section aria-live="polite" className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card"><h2 className="font-body-sm-medium text-body-sm-medium text-on-surface">Confirm your place</h2>{now < opensAt ? <p className="font-body-sm text-body-sm text-text-secondary">Confirmation opens in {countdown(opensAt)}.</p> : confirmationOpen ? <><p className="font-body-sm text-body-sm text-text-secondary">The confirmation window is open. It closes in {countdown(closesAt)}.</p><button type="button" disabled={confirmPending} onClick={() => void confirmAttendance()} className={actionPrimary}>{confirmPending ? 'Confirming…' : 'Confirm attendance'}</button></> : <p className="font-body-sm text-body-sm text-text-secondary">The confirmation window has closed.</p>}{confirmMessage && <p role="status" className="font-caption text-caption text-text-secondary">{confirmMessage}</p>}</section>}
      {registration.status === 'confirmed' && <p role="status" className="font-body-sm text-body-sm text-status-available">Your place is confirmed.</p>}
      {details.seminarType === 'webinar' && <span className="w-fit rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-label-sm text-primary">Webinar</span>}
      {details.seminarType === 'webinar' && registration.status === 'confirmed' && now >= Date.parse(details.startsAt) - 60 * 60_000 && now <= Date.parse(details.endsAt) && details.joinUrl && <a href={details.joinUrl} target="_blank" rel="noreferrer" className={actionTonal}>Join webinar</a>}

      {seminar.state.status === 'success' && seminar.state.fromCache && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary"
        >
          <Icon name="info" size={18} />
          You are offline. Showing your saved copy of this seminar.
        </p>
      )}

      <Tabs
        tabs={tabs}
        selectedId={selected}
        onSelect={selectTab}
        ariaLabel="Seminar sections"
        renderPanel={(tab) =>
          tab === 'details' ? (
            <DetailsTab seminar={details} />
          ) : tab === 'ticket' ? (
            <TicketTab seminar={details} registration={registration} now={now} />
          ) : (
            <EvaluationTab item={item} now={now} />
          )
        }
      />
    </PageContainer>
  );
}
