export type AttendanceStatus = 'below' | 'met' | 'unknown';
export type OrgRegistrationStatus = 'registered' | 'confirmed' | 'released' | 'cancelled' | undefined;

export function isEligibleOrgRegistration(status: OrgRegistrationStatus, removed: boolean): boolean {
  return !removed && status !== 'released' && status !== 'cancelled';
}

export function attendanceThreshold(value: number | null | undefined): number {
  return value ?? 60;
}

export function attendanceStatus(rate: number | null, threshold: number): AttendanceStatus {
  if (rate === null) return 'unknown';
  return rate >= threshold ? 'met' : 'below';
}
