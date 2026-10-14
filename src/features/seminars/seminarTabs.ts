import type { SeminarListItem } from '../../api/types';
import { getLifecycle, isEvaluationDue } from './status';

export const SEMINAR_TABS = ['details', 'ticket', 'evaluation'] as const;
export type SeminarTab = (typeof SEMINAR_TABS)[number];

export function isSeminarTab(value: string | null): value is SeminarTab {
  return SEMINAR_TABS.some((tab) => tab === value);
}

/** Ticket while registered and not finished; evaluation when finished and due; otherwise details. */
export function getDefaultTab(item: SeminarListItem, now: number): SeminarTab {
  if (item.registration && getLifecycle(item.seminar, now) !== 'finished') return 'ticket';
  if (isEvaluationDue(item, now)) return 'evaluation';
  return 'details';
}

export type EvaluationAccess =
  | { state: 'unlocked' }
  | { state: 'submitted'; submittedAt: string }
  | { state: 'locked'; reason: 'upcoming' | 'ongoing' | 'no_time_out' | 'time_out_unvalidated' };

/** Business rule (needs confirmation): open once finished and the Time-Out is validated. */
export function getEvaluationAccess(item: SeminarListItem, now: number): EvaluationAccess {
  const { seminar, registration } = item;
  const lifecycle = getLifecycle(seminar, now);
  if (lifecycle !== 'finished') return { state: 'locked', reason: lifecycle };
  if (registration?.evaluationSubmittedAt) {
    return { state: 'submitted', submittedAt: registration.evaluationSubmittedAt };
  }
  if (!registration?.timeOut) return { state: 'locked', reason: 'no_time_out' };
  if (!registration.timeOut.validated) return { state: 'locked', reason: 'time_out_unvalidated' };
  return { state: 'unlocked' };
}