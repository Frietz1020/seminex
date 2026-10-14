import { Link } from 'react-router-dom';
import type { EvaluationDue } from '../../../api/types';
import type { ResourceState } from '../../../hooks/useResource';
import { actionSecondary } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';

interface EvaluationBannerProps {
  state: ResourceState<EvaluationDue[]>;
  onRetry: () => void;
}

/** One banner per finished seminar with an evaluation due. Hidden when there is none. */
export function EvaluationBanner({ state, onRetry }: EvaluationBannerProps) {
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Checking for evaluations to complete">
        <Skeleton className="h-20 w-full" />
      </LoadingRegion>
    );
  }
  if (state.status === 'error') {
    return <InlineError onRetry={onRetry}>Evaluation reminders could not be loaded.</InlineError>;
  }
  if (state.status === 'empty') return null;

  return (
    <div className="flex flex-col gap-space-sm">
      {state.data.map((due) => (
        <div
          key={due.seminarId}
          className="flex w-full flex-col items-start justify-between gap-space-md rounded-lg bg-status-finished-container p-space-md shadow-card sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <Icon name="assignment_turned_in" size={24} className="mt-0.5 text-status-finished" />
            <div className="flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-status-finished">
                Finished: {due.seminarTitle}
              </h2>
              <p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
                This seminar has concluded. Answer the evaluation form to qualify for your certificate.
              </p>
            </div>
          </div>
          <Link
            to={`/my-seminars/${due.seminarId}/evaluation`}
            className={cx(actionSecondary, 'shrink-0')}
          >
            <span>Complete evaluation</span>
            <Icon name="rate_review" size={16} />
          </Link>
        </div>
      ))}
    </div>
  );
}