import { describe, expect, it } from 'vitest';
import { attendanceChallengePayload, parseAttendanceChallengePayload } from './AttendanceQr';

describe('attendance QR payload', () => {
  it('contains only the live opaque challenge and never a Student ID', () => {
    expect(attendanceChallengePayload('a'.repeat(64))).toBe(`SEMINEX1:${'a'.repeat(64)}`);
    expect(attendanceChallengePayload('a'.repeat(64))).not.toContain('202410770');
  });

  it('rejects malformed challenge data', () => {
    expect(() => attendanceChallengePayload('202410770')).toThrow();
  });

  it('parses only the Seminex challenge format', () => {
    expect(parseAttendanceChallengePayload(`SEMINEX1:${'c'.repeat(64)}`)).toBe('c'.repeat(64));
    expect(parseAttendanceChallengePayload('202410770')).toBeNull();
    expect(parseAttendanceChallengePayload(`SEMINEX1:${'c'.repeat(63)}`)).toBeNull();
  });
});
