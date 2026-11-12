import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, getSessionIdentity, saveSession } from './storage';

describe('session identity snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
  });

  it('keeps the snapshot reference stable until the session changes', () => {
    saveSession({
      studentId: '202410001',
      token: 'mock-token',
      expiresAt: 1_900_000_000_000,
      role: 'participant',
      organizationIds: [],
    });

    const first = getSessionIdentity();
    const second = getSessionIdentity();

    expect(second).toBe(first);
  });

  it('returns an updated snapshot after the session changes', () => {
    saveSession({
      studentId: '202410001',
      token: 'mock-token',
      expiresAt: 1_900_000_000_000,
      role: 'participant',
      organizationIds: [],
    });
    const first = getSessionIdentity();

    saveSession({
      studentId: '202410001',
      token: 'mock-token-2',
      expiresAt: 1_900_000_000_000,
      role: 'org_member',
      organizationIds: ['ccs-council'],
    });

    const updated = getSessionIdentity();
    expect(updated).not.toBe(first);
    expect(updated?.role).toBe('org_member');
    expect(updated?.organizationIds).toEqual(['ccs-council']);
  });
});
