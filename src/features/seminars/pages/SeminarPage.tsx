import { useEffect } from 'react';
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

export default function SeminarPage() {
  const { id = '' } = useParams();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');

  const seminar = useResource(() => api.getSeminar(id), `seminar-${id}`);
  const item = seminar.state.status === 'success' ? seminar.state.data : null;

  useEffect(() => {
    document.title = item ? `${item.seminar.title} - Seminex` : 'Seminar - Seminex';
  }, [item]);

  const defaultTab: SeminarTab | null = item ? getDefaultTab(item, now) : null;
  const selected: SeminarTab = isSeminarTab(requested) ? requested : (defaultTab ?? 'details');

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

  const { seminar: details, registration } = item;
  const access = getEvaluationAccess(item, now);
  const locked = access.state === 'locked';
  const tabs: TabItem[] = [
    { id: 'details', label: 'Details', icon: 'info' },
    { id: 'ticket', label: 'Attendance & ticket', icon: 'how_to_reg' },
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
