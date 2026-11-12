import { Icon } from '../../../components/ui/Icon';
import type { EvaluationAccess } from '../seminarTabs';

type LockedReason = Extract<EvaluationAccess, { state: 'locked' }>['reason'];

const REASONS: Record<LockedReason, string> = {
  no_time_out:
    'A validated Time-Out is required before you can open this evaluation. Ask an officer if your attendance record is incomplete.',
  time_out_unvalidated:
    'Your Time-Out is waiting for validation. You can open the evaluation after it is validated.',
  insufficient_attendance:
    'Your recorded attendance is below this seminar’s requirement, so this evaluation is unavailable.',
};

/** The locked evaluation state, shared by the seminar page's Evaluation tab and the Evaluation page. */
export function EvaluationLocked({ reason }: { reason: LockedReason }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card px-space-xl py-16 text-center shadow-card">
      <div
        aria-hidden="true"
        className="mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-text-subtle"
      >
        <Icon name="lock" size={32} />
      </div>
      <span className="mb-space-xs inline-flex items-center rounded-sm bg-surface-container-high px-3 py-1 font-label-sm text-label-sm uppercase text-status-finished">
        Access restricted
      </span>
      <h2 className="font-headline-md text-headline-md text-on-surface">Evaluation locked</h2>
      <p className="mt-space-xs max-w-md font-body-base text-body-base text-text-secondary">{REASONS[reason]}</p>
    </div>
  );
}
