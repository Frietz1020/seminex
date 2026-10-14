/**
 * Turns the student's finished seminars into history records. Home, History, and Profile all
 * count from here, so their numbers cannot disagree.
 *
 * Business rules (need confirmation):
 * - The history holds every finished seminar the student registered for.
 * - A certificate is ready when the attendance percentage reaches the required percentage AND
 *   the evaluation is submitted. Nothing here reads a stored "certificate issued" flag.
 * - Attendance counts only from a validated Time-Out. With no Time-Out, or one not yet
 *   validated, there is no attendance percentage and the record is not eligible.
 */
import type { Registration, Seminar, SeminarListItem } from '../../api/types';
import { getAttendance, getLifecycle, isEvaluationDue } from '../seminars/status';

export type RecordStatus =
  | 'ready'
  | 'evaluation_pending'
  | 'below_minimum'
  | 'no_time_out'
  | 'time_out_unvalidated';

export interface HistoryRecord {
  seminar: Seminar;
  registration: Registration;
  status: RecordStatus;
  /** Whole percent, rounded down so a shown value never claims more than was attended. Null without a validated Time-Out. */
  attendancePercent: number | null;
  requiredPercent: number;
  evaluationSubmitted: boolean;
  /** True when the evaluation page is open to this student and nothing was submitted. */
  evaluationDue: boolean;
}

export interface HistorySummary {
  /** Every finished seminar the student registered for. */
  completed: number;
  ready: number;
  /** Records that are not ready. */
  pending: number;
  /** Records with a validated Time-Out, so an attendance percentage exists. */
  attended: number;
  evaluationsPending: number;
  /** Mean of the attendance percentages that exist, or null when there are none. */
  averageAttendance: number | null;
}

function getStatus(registration: Registration, attendanceMet: boolean, evaluationSubmitted: boolean): RecordStatus {
  if (!registration.timeOut) return 'no_time_out';
  if (!registration.timeOut.validated) return 'time_out_unvalidated';
  if (!attendanceMet) return 'below_minimum';
  return evaluationSubmitted ? 'ready' : 'evaluation_pending';
}

export function buildHistoryRecords(items: readonly SeminarListItem[], now: number): HistoryRecord[] {
  const records: HistoryRecord[] = [];
  for (const item of items) {
    const { seminar, registration } = item;
    if (!registration || getLifecycle(seminar, now) !== 'finished') continue;

    const attendance = getAttendance(seminar, registration, now);
    const evaluationSubmitted = registration.evaluationSubmittedAt !== null;
    const status = getStatus(registration, attendance.satisfied, evaluationSubmitted);
    const hasPercent = status !== 'no_time_out' && status !== 'time_out_unvalidated';

    records.push({
      seminar,
      registration,
      status,
      attendancePercent: hasPercent
        ? Math.min(100, Math.floor((attendance.attendedMinutes / Math.max(1, attendance.durationMinutes)) * 100))
        : null,
      requiredPercent: seminar.requiredAttendancePercent,
      evaluationSubmitted,
      evaluationDue: isEvaluationDue({ seminar, registration }, now),
    });
  }
  return records.sort((a, b) => Date.parse(b.seminar.endsAt) - Date.parse(a.seminar.endsAt));
}

export function summarizeHistory(records: readonly HistoryRecord[]): HistorySummary {
  const ready = records.filter((record) => record.status === 'ready').length;
  const percents = records.flatMap((record) => (record.attendancePercent === null ? [] : [record.attendancePercent]));
  return {
    completed: records.length,
    ready,
    pending: records.length - ready,
    attended: percents.length,
    evaluationsPending: records.filter((record) => record.evaluationDue).length,
    averageAttendance:
      percents.length === 0 ? null : Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length),
  };
}