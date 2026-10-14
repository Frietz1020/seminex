import type { Registration, Seminar, SeminarListItem } from '../../api/types';

export type SeminarStatus = 'available' | 'full' | 'ongoing' | 'finished' | 'registered';
export type Lifecycle = 'upcoming' | 'ongoing' | 'finished';

const MINUTE = 60_000;

/** Every status is derived from schedule, capacity, and registration. Nothing is stored as a string. */
export function getLifecycle(seminar: Seminar, now: number): Lifecycle {
  if (now >= Date.parse(seminar.endsAt)) return 'finished';
  if (now >= Date.parse(seminar.startsAt)) return 'ongoing';
  return 'upcoming';
}

export function slotsLeft(seminar: Seminar): number {
  return Math.max(0, seminar.capacity - seminar.registeredCount);
}

export function isFull(seminar: Seminar): boolean {
  return slotsLeft(seminar) === 0;
}

export function isRegistered(item: SeminarListItem): boolean {
  return item.registration !== null;
}

/** Precedence: finished, ongoing, full, available. "Registered" is a separate flag. */
export function getPrimaryStatus(item: SeminarListItem, now: number): Exclude<SeminarStatus, 'registered'> {
  const lifecycle = getLifecycle(item.seminar, now);
  if (lifecycle === 'finished') return 'finished';
  if (lifecycle === 'ongoing') return 'ongoing';
  return isFull(item.seminar) ? 'full' : 'available';
}

export function getStatuses(item: SeminarListItem, now: number): SeminarStatus[] {
  const statuses: SeminarStatus[] = [getPrimaryStatus(item, now)];
  if (isRegistered(item)) statuses.push('registered');
  return statuses;
}

/** Business rule (needs confirmation): due once finished, with a validated Time-Out and no submission. */
export function isEvaluationDue(item: SeminarListItem, now: number): boolean {
  const { seminar, registration } = item;
  return (
    registration !== null &&
    getLifecycle(seminar, now) === 'finished' &&
    registration.timeOut?.validated === true &&
    registration.evaluationSubmittedAt === null
  );
}

export interface Attendance {
  durationMinutes: number;
  requiredMinutes: number;
  attendedMinutes: number;
  timeInRecorded: boolean;
  timeOutRecorded: boolean;
  /** True only when a Time-In exists and the attended minutes reach the minimum. */
  satisfied: boolean;
}

/**
 * Business rules (need confirmation): the minimum is the required percentage of the seminar
 * duration, and time counts from Time-In to Time-Out, or to now (capped at the end) while
 * the Time-Out is pending.
 */
export function getAttendance(seminar: Seminar, registration: Registration | null, now: number): Attendance {
  const start = Date.parse(seminar.startsAt);
  const end = Date.parse(seminar.endsAt);
  const durationMinutes = Math.max(0, Math.round((end - start) / MINUTE));
  const requiredMinutes = Math.ceil((durationMinutes * seminar.requiredAttendancePercent) / 100);

  let attendedMinutes = 0;
  if (registration?.timeIn) {
    const from = Date.parse(registration.timeIn.at);
    const to = registration.timeOut ? Date.parse(registration.timeOut.at) : Math.min(now, end);
    attendedMinutes = Math.max(0, Math.floor((to - from) / MINUTE));
  }

  const timeInRecorded = registration?.timeIn != null;
  return {
    durationMinutes,
    requiredMinutes,
    attendedMinutes,
    timeInRecorded,
    timeOutRecorded: registration?.timeOut != null,
    satisfied: timeInRecorded && attendedMinutes >= requiredMinutes,
  };
}