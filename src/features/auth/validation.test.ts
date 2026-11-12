import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateNewPassword, validateStudentId } from './validation';

afterEach(() => vi.useRealTimers());

describe('password reset validation', () => {
  it('validates Student ID boundaries', () => {
    expect(validateStudentId('202410001')).toBeUndefined();
    expect(validateStudentId('123')).toBeDefined();
  });
  it('requires all password rules', () => {
    expect(validateNewPassword('short')).toBeDefined();
    expect(validateNewPassword('Seminex_2026')).toBeUndefined();
  });
});
