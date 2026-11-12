import { describe, expect, it } from 'vitest';
import type { Seminar } from '../api/types';
import { getStudentSeminarPlacement } from './seminarStatus';
import { getLifecycle } from './seminarLifecycle';

const seminar: Seminar = { id: 's', reference: 'SEM-1', title: 'Test', description: 'Test', speaker: { name: 'A', role: 'B' }, venue: 'Room', department: 'CCS', topics: [], startsAt: '2026-01-01T09:00:00.000Z', endsAt: '2026-01-01T11:00:00.000Z', capacity: 10, registeredCount: 0, requiredAttendancePercent: 60 };

describe('seminar lifecycle and one-hour placement', () => {
  it('derives lifecycle from its schedule', () => {
    expect(getLifecycle(seminar, Date.parse('2026-01-01T08:59:00.000Z'))).toBe('upcoming');
    expect(getLifecycle(seminar, Date.parse('2026-01-01T10:00:00.000Z'))).toBe('ongoing');
    expect(getLifecycle(seminar, Date.parse('2026-01-01T11:00:00.000Z'))).toBe('finished');
  });
  it('moves a finished seminar to History at the one-hour boundary', () => {
    expect(getStudentSeminarPlacement(seminar, Date.parse('2026-01-01T11:59:59.000Z'))).toBe('home');
    expect(getStudentSeminarPlacement(seminar, Date.parse('2026-01-01T12:00:00.000Z'))).toBe('history');
  });
});
