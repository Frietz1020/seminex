import type { Profile, Program, Seminar, YearLevel } from '../../api/types';
import { programCode, programLabel, yearLevelLabel } from '../../data/academic';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const WEEKDAY_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const HOURS = new Intl.NumberFormat('en', { style: 'unit', unit: 'hour', unitDisplay: 'long' });
const MINUTES = new Intl.NumberFormat('en', { style: 'unit', unit: 'minute', unitDisplay: 'long' });

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatClockTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatClockTime(startIso)} \u2013 ${formatClockTime(endIso)}`;
}

/** "Today, Nov 18, 2025" for today, otherwise "Friday, Nov 21, 2025". */
export function formatDayLabel(iso: string, now: number): string {
  const date = new Date(iso);
  return date.toDateString() === new Date(now).toDateString()
    ? `Today, ${formatDate(iso)}`
    : WEEKDAY_DATE.format(date);
}

/** "2 hours 6 minutes". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(HOURS.format(hours));
  if (minutes > 0 || parts.length === 0) parts.push(MINUTES.format(minutes));
  return parts.join(' ');
}

export function formatStarted(startsAtIso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(startsAtIso)) / 60_000);
  return minutes < 1 ? 'Started just now' : `Started ${formatDuration(minutes)} ago`;
}

export function formatSlots(seminar: Seminar, detailed: boolean): string {
  const left = Math.max(0, seminar.capacity - seminar.registeredCount);
  if (left === 0) {
    return detailed
      ? `No slots left, ${seminar.registeredCount} of ${seminar.capacity} registered`
      : 'No slots left';
  }
  const base = `${left} ${left === 1 ? 'slot' : 'slots'} left`;
  return detailed ? `${base}, ${seminar.capacity} total` : base;
}

export function programName(program: Program): string {
  return programLabel(program);
}

/** "3rd year". */
export function formatYearLevel(level: YearLevel): string {
  return yearLevelLabel(level);
}

export function formatFullName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName} ${profile.lastName}`;
}

/** "3rd year Information Technology, College of Computer Studies, Gordon College". */
export function formatAcademicLine(profile: Profile): string {
  return `${yearLevelLabel(profile.yearLevel)} ${programName(profile.program)}, College of Computer Studies, Gordon College`;
}

/** "202110482 \u00b7 BSCS 3-A": student number, program, year level, and block. */
export function formatStudentLine(profile: Pick<Profile, 'studentId' | 'program' | 'yearLevel' | 'block'>): string {
  return `${profile.studentId} \u00b7 ${programCode(profile.program)} ${profile.yearLevel}-${profile.block}`;
}