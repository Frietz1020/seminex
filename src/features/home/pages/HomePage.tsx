import { useEffect } from 'react';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { useRegistration } from '../../seminars/useRegistration';
import { EvaluationBanner } from '../components/EvaluationBanner';
import { GreetingHeader } from '../components/GreetingHeader';
import { HistoryLinkCard } from '../components/HistoryLinkCard';
import { OngoingSection } from '../components/OngoingSection';
import { UpcomingSeminars } from '../components/UpcomingSeminars';

export default function HomePage() {
  const now = useNow();
  const seminars = useResource(() => api.listSeminars(), 'home-seminars', (items) => items.length === 0);
  const evaluations = useResource(
    () => api.listEvaluationsDue(),
    'home-evaluations',
    (due) => due.length === 0,
  );

  const baseItems = seminars.state.status === 'success' ? seminars.state.data : null;
  const registration = useRegistration(baseItems);

  useEffect(() => {
    document.title = 'Home - Seminex';
  }, []);

  return (
    <PageContainer>
      <GreetingHeader />
      <EvaluationBanner state={evaluations.state} onRetry={evaluations.reload} />
      <OngoingSection
        state={seminars.state}
        items={registration.items}
        now={now}
        onRetry={seminars.reload}
      />
      <UpcomingSeminars
        state={seminars.state}
        items={registration.items}
        now={now}
        pendingId={registration.pendingId}
        onRegister={registration.register}
        onRetry={seminars.reload}
      />
      <HistoryLinkCard
        state={seminars.state}
        items={registration.items}
        now={now}
        onRetry={seminars.reload}
      />
    </PageContainer>
  );
}