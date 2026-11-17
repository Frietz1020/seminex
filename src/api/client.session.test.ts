import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionIdentity } from './types';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getProfile: vi.fn(),
  getTicket: vi.fn(),
  getSeminar: vi.fn(),
  getServerTime: vi.fn(),
  listMySeminars: vi.fn(),
  createTicketPdf: vi.fn(),
  cacheTicket: vi.fn(),
  readTicket: vi.fn(),
  cacheRegisteredItems: vi.fn(),
  clearOfflineCache: vi.fn(),
  clearOrgOfflineCache: vi.fn(),
}));

vi.mock('./auth', () => ({
  signIn: mocks.signIn,
  signOut: mocks.signOut,
  getProfile: mocks.getProfile,
}));
vi.mock('./seminars', () => ({
  getTicket: mocks.getTicket,
  getSeminar: mocks.getSeminar,
  listMySeminars: mocks.listMySeminars,
}));
vi.mock('./serverTime', () => ({ getServerTime: mocks.getServerTime }));
vi.mock('./attendance', () => ({ acknowledgeAttendance: vi.fn() }));
vi.mock('./evaluations', () => ({
  listEvaluationsDue: vi.fn(),
  getEvaluationSurvey: vi.fn(),
  submitEvaluation: vi.fn(),
  getOrgSeminarEvaluation: vi.fn(),
}));
vi.mock('./certificates', () => ({ getCertificate: vi.fn(), getOrgSeminarCertificates: vi.fn(), getOrgCertificate: vi.fn() }));
vi.mock('./adviser', () => ({
  listAdviserOrgRequests: vi.fn(),
  listAdviserOrgMembers: vi.fn(),
  updateAdviserMemberPosition: vi.fn(),
  removeAdviserMember: vi.fn(),
  decideAdviserOrgRequest: vi.fn(),
}));
vi.mock('./offlineCache', () => ({
  cacheTicket: mocks.cacheTicket,
  readTicket: mocks.readTicket,
  cacheRegisteredItems: mocks.cacheRegisteredItems,
  clearOfflineCache: mocks.clearOfflineCache,
}));
vi.mock('./orgOfflineCache', () => ({ clearOrgOfflineCache: mocks.clearOrgOfflineCache }));
vi.mock('./ticketPdf', () => ({ createTicketPdf: mocks.createTicketPdf }));

import { api } from './client';

describe('Supabase API client', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const mock of Object.values(mocks)) mock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores a safe identity after Supabase sign-in', async () => {
    const identity: SessionIdentity = {
      studentId: '209999901', expiresAt: Date.now() + 60_000, role: 'participant', organizationIds: [],
    };
    mocks.signIn.mockResolvedValue({ ok: true, data: identity });

    await expect(api.signIn({ studentId: identity.studentId, password: 'password' })).resolves.toEqual({ ok: true, data: identity });
    expect(JSON.parse(localStorage.getItem('seminex.identity') ?? 'null')).toEqual(identity);
    expect(localStorage.getItem('seminex.identity')).not.toContain('token');
  });

  it('uses Supabase ticket reads and caches successful results', async () => {
    const ticket = { seminarId: 'seminar-1', studentId: '207000711', issuedAt: '2026-11-06T07:00:00Z' };
    localStorage.setItem('seminex.identity', JSON.stringify({
      studentId: ticket.studentId, expiresAt: Date.now() + 60_000, role: 'participant', organizationIds: [],
    }));
    mocks.getTicket.mockResolvedValue({ ok: true, data: ticket });

    await expect(api.getTicket(ticket.seminarId)).resolves.toEqual({ ok: true, data: ticket });
    expect(mocks.getTicket).toHaveBeenCalledWith(ticket.seminarId);
    expect(mocks.cacheTicket).toHaveBeenCalledWith(ticket.studentId, ticket);
  });

  it('clears local session and caches even when Supabase sign-out fails', async () => {
    localStorage.setItem('seminex.identity', JSON.stringify({
      studentId: '202410001', expiresAt: Date.now() + 60_000, role: 'participant', organizationIds: [],
    }));
    mocks.signOut.mockResolvedValue({ ok: false, error: { code: 'network' } });

    await expect(api.signOut()).resolves.toEqual({ ok: false, error: { code: 'network' } });
    expect(localStorage.getItem('seminex.identity')).toBeNull();
    expect(mocks.clearOfflineCache).toHaveBeenCalledWith('202410001');
    expect(mocks.clearOrgOfflineCache).toHaveBeenCalledWith('202410001');
  });

  it('does not expose local mock or backup controls', () => {
    expect(api).not.toHaveProperty('isMockMode');
    expect(api).not.toHaveProperty('isLocalMockMode');
    expect(api).not.toHaveProperty('exportLocalMockBackup');
    expect(api).not.toHaveProperty('importLocalMockBackup');
  });
});
