import type { Seminar } from '../api/types';

export type Lifecycle = 'upcoming' | 'ongoing' | 'finished';

/** Shared schedule lifecycle for student and organization views. */
export function getLifecycle(seminar: Seminar, now: number, effectiveEnd = Date.parse(seminar.endsAt)): Lifecycle {
  if (now >= effectiveEnd) return 'finished';
  if (now >= Date.parse(seminar.startsAt)) return 'ongoing';
  return 'upcoming';
}
