import { describe, expect, it } from 'vitest';
import { attendanceStatus, attendanceThreshold, isEligibleOrgRegistration } from './attendanceStatus';

describe('adviser attendance threshold status', () => {
  it('uses 60 percent when a seminar has no configured threshold', () => {
    expect(attendanceThreshold(undefined)).toBe(60);
    expect(attendanceThreshold(null)).toBe(60);
  });

  it('uses the seminar configured threshold at below, exact, and above boundaries', () => {
    expect(attendanceStatus(59, 60)).toBe('below');
    expect(attendanceStatus(60, 60)).toBe('met');
    expect(attendanceStatus(61, 60)).toBe('met');
    expect(attendanceStatus(75, 75)).toBe('met');
  });

  it('does not classify missing attendance as meeting a threshold', () => {
    expect(attendanceStatus(null, 60)).toBe('unknown');
  });

  it('counts only active, non-removed registrations in attendance denominators', () => {
    expect(isEligibleOrgRegistration('confirmed', false)).toBe(true);
    expect(isEligibleOrgRegistration('registered', false)).toBe(true);
    expect(isEligibleOrgRegistration('released', false)).toBe(false);
    expect(isEligibleOrgRegistration('cancelled', false)).toBe(false);
    expect(isEligibleOrgRegistration('confirmed', true)).toBe(false);
  });
});
