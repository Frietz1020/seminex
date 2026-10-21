import type { OrgSeminar } from '../../api/orgTypes';
import { RECENTLY_FINISHED_WINDOW_MS } from '../../lib/seminarStatus';

export type OrgLifecycle = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';

/** The time the seminar counts as over: the scheduled end, or the earlier time an officer chose End now. */
export function getEffectiveEnd(seminar: OrgSeminar): number {
  const scheduled = Date.parse(seminar.endsAt);
  return seminar.endedEarlyAt ? Math.min(scheduled, Date.parse(seminar.endedEarlyAt)) : scheduled;
}

/**
 * Derived from the start and end time. Only three stored flags change the result: cancelled (with a
 * reason, time, and officer), ended early, and, outside this function, registration closed.
 */
export function getOrgLifecycle(seminar: OrgSeminar, now: number): OrgLifecycle {
  if (seminar.cancellation) return 'cancelled';
  if (now >= getEffectiveEnd(seminar)) return 'finished';
  if (now >= Date.parse(seminar.startsAt)) return 'ongoing';
  return 'upcoming';
}

/**
 * The same one hour rule as the student side: a finished seminar stays on Home and in the My Seminars
 * "Finished recently" filter for one hour, then moves to History. The window counts from the effective end.
 */
export function isOrgRecentlyFinished(seminar: OrgSeminar, now: number): boolean {
  if (getOrgLifecycle(seminar, now) !== 'finished') return false;
  return now - getEffectiveEnd(seminar) < RECENTLY_FINISHED_WINDOW_MS;
}