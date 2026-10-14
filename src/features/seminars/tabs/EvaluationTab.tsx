import { Link } from 'react-router-dom';
import type { SeminarListItem } from '../../../api/types';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { EvaluationLocked } from '../components/EvaluationLocked';
import { formatDate } from '../format';
import { getEvaluationAccess } from '../seminarTabs';

export function EvaluationTab({ item, now }: { item: SeminarListItem; now: number }) {
  const { seminar, registration } = item;
  const access = getEvaluationAccess(item, now);

  if (access.state === 'locked') {
    return <EvaluationLocked reason={access.reason} endsAt={seminar.endsAt} />;
  }

  if (access.state === 'submitted') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card px-space-xl py-16 text-center shadow-card">
        <div
          aria-hidden="true"
          className="mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-status-available-container text-status-available"
        >
          <Icon name="check_circle" size={32} />
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Evaluation submitted</h2>
        <p className="mt-space-xs max-w-md font-body-base text-body-base text-text-secondary">
          You submitted your evaluation on {formatDate(access.submittedAt)}.{' '}
          {registration?.certificateIssuedAt
            ? 'Your certificate is available in History.'
            : 'Your certificate is issued once all conditions are met.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card px-space-xl py-16 text-center shadow-card">
      <div
        aria-hidden="true"
        className="mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-maroon-container text-primary-container"
      >
        <Icon name="rate_review" size={32} />
      </div>
      <h2 className="font-headline-md text-headline-md text-on-surface">Your evaluation is ready</h2>
      <p className="mt-space-xs max-w-md font-body-base text-body-base text-text-secondary">
        Answer a short evaluation to qualify for your certificate.
      </p>
      <Link to={`/my-seminars/${seminar.id}/evaluation`} className={`${actionPrimary} mt-space-lg`}>
        <Icon name="rate_review" size={18} />
        <span>Start evaluation</span>
      </Link>
    </div>
  );
}