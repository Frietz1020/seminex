import { Icon } from '../../../components/ui/Icon';
import { formatClockTime } from '../format';
import type { EvaluationAccess } from '../seminarTabs';

type LockedReason = Extract<EvaluationAccess, { state: 'locked' }>['reason'];

const REASONS: Record<LockedReason, string> = {
  upcoming: 'The evaluation opens after the seminar is finished. This seminar has not started yet.',
  ongoing: 'Opens when the seminar is finished. Status is currently Ongoing.',
  no_time_out:
    'No Time-Out was recorded, so the evaluation cannot be opened. Ask a CCS Student Council officer for help.',
  time_out_unvalidated:
    'Your Time-Out is waiting for validation by a marshal. The evaluation opens after it is validated.',
};

/** The locked evaluation state, shared by the seminar page's Evaluation tab and the Evaluation page. */
export function EvaluationLocked({ reason, endsAt }: { reason: LockedReason; endsAt: string }) {
  const showEndNote = reason === 'upcoming' || reason === 'ongoing';
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
      {showEndNote && (
        <div className="mt-space-lg flex max-w-md items-center gap-space-sm rounded-lg bg-surface-container-low p-space-md text-left">
          <Icon name="notifications_active" size={20} className="shrink-0 text-primary-container" />
          <span className="font-body-sm text-body-sm text-text-secondary">
            After the seminar ends at {formatClockTime(endsAt)}, a marshal validates your Time-Out. You can submit the
            evaluation once that is done.
          </span>
        </div>
      )}
    </div>
  );
}