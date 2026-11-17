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
import { getStudentSeminarPlacement } from '../../../lib/seminarStatus';

export default function HomePage() {
  const now = useNow();
  const seminars = useResource(() => api.listMySeminars({ pageSize: 999 }), 'home-seminars', (page) => page.items.length === 0);
  const evaluations = useResource(
    () => api.listEvaluationsDue(),
    'home-evaluations',
    (due) => due.length === 0,
  );

  const baseItems = seminars.state.status === 'success' ? seminars.state.data.items : null;
  const registration = useRegistration(baseItems);
  const historyItems = now === null ? null : registration.items?.filter((item) => getStudentSeminarPlacement(item.seminar, now) === 'history') ?? null;
  const sectionState = seminars.state.status === 'success'
    ? { ...seminars.state, data: seminars.state.data.items }
    : seminars.state;

  useEffect(() => {
    document.title = 'Home - Seminex';
  }, []);

  if (now === null) {
    return <PageContainer><p role="status" className="font-body-sm text-body-sm text-text-secondary">Loading current seminar times…</p></PageContainer>;
  }

  return (
    <PageContainer>
      <GreetingHeader />
      <EvaluationBanner state={evaluations.state} onRetry={evaluations.reload} />
      <OngoingSection
        state={sectionState}
        items={registration.items}
        now={now}
        onRetry={seminars.reload}
      />
      <HistoryLinkCard
        state={sectionState}
        items={historyItems}
        now={now}
        onRetry={seminars.reload}
      />
    </PageContainer>
  );
}
