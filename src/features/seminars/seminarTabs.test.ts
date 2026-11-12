import { describe, expect, it } from 'vitest';
import type { SeminarListItem } from '../../api/types';
import { getEvaluationAccess } from './seminarTabs';

function registeredItem(timeIn: number, timeOut: number): SeminarListItem {
  return {
    seminar: {
      id: 'seminar-1',
      reference: 'SEM-1',
      title: 'Evaluation seminar',
      description: 'Seminar description',
      speaker: { name: 'Speaker', role: 'Instructor' },
      venue: 'CCS Hall',
      department: 'CCS',
      topics: [],
      startsAt: new Date(0).toISOString(),
      endsAt: new Date(120 * 60_000).toISOString(),
      capacity: 10,
      registeredCount: 1,
      requiredAttendancePercent: 60,
    },
    registration: {
      reference: 'TKT-1',
      registeredAt: new Date(0).toISOString(),
      status: 'confirmed',
      confirmedAt: new Date(0).toISOString(),
      attendanceAckAt: null,
      timeIn: { at: new Date(timeIn).toISOString() },
      timeOut: { at: new Date(timeOut).toISOString(), validated: true },
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
  };
}

describe('getEvaluationAccess', () => {
  it('unlocks after attendance threshold as soon as validated Time-Out exists', () => {
    const item = registeredItem(0, 73 * 60_000);

    expect(getEvaluationAccess(item, 73 * 60_000)).toEqual({ state: 'unlocked' });
  });

  it('keeps a completed seminar locked when attendance is below its threshold', () => {
    const item = registeredItem(0, 60 * 60_000);

    expect(getEvaluationAccess(item, 130 * 60_000)).toEqual({ state: 'locked', reason: 'insufficient_attendance' });
  });
});
