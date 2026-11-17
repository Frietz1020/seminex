import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import {
  decideAdviserOrgRequest,
  listAdviserOrgMembers,
  listAdviserOrgRequests,
  removeAdviserMember,
  updateAdviserMemberPosition,
} from './adviser';

const request = {
  id: 'request-1',
  studentId: '209999901',
  fullName: 'Test Student',
  organizationId: 'org-1',
  position: 'Secretary',
  requestedAt: '2026-11-10T00:00:00Z',
  status: 'approved',
};

const member = {
  id: 'membership-1',
  organizationId: 'org-1',
  fullName: 'Test Student',
  email: '209999901@gordoncollege.edu.ph',
  studentId: '209999901',
  position: 'Secretary',
  status: 'active',
  appointedAt: '2026-11-10T00:00:00Z',
  category: 'member',
};

const adviser = {
  id: 'membership-2',
  organizationId: 'org-1',
  fullName: 'Faculty Adviser',
  email: 'adviser@gordoncollege.edu.ph',
  position: 'Faculty adviser',
  status: 'active',
  appointedAt: '',
  category: 'adviser',
};

describe('Supabase adviser adapter', () => {
  beforeEach(() => mocks.getSupabaseClient.mockReset());

  it('lists adviser requests through the scoped RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [request], error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(listAdviserOrgRequests()).resolves.toEqual({ ok: true, data: [request] });
    expect(client.rpc).toHaveBeenCalledWith('list_adviser_org_requests');
  });

  it('lists active, removed, and adviser directory entries through the scoped RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [member, { ...member, status: 'removed' }, adviser], error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(listAdviserOrgMembers()).resolves.toEqual({
      ok: true,
      data: [member, { ...member, status: 'removed' }, adviser],
    });
    expect(client.rpc).toHaveBeenCalledWith('list_adviser_org_members');
  });

  it('approves a request through the atomic adviser RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: request, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(decideAdviserOrgRequest('request-1', 'approved', 'Verified'))
      .resolves.toMatchObject({ ok: true, data: { status: 'approved' } });
    expect(client.rpc).toHaveBeenCalledWith('decide_adviser_org_request', {
      p_request_id: 'request-1', p_decision: 'approved', p_decision_note: 'Verified',
    });
  });

  it('sends null for an omitted optional decision note', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: request, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await decideAdviserOrgRequest('request-1', 'rejected');

    expect(client.rpc).toHaveBeenCalledWith('decide_adviser_org_request', {
      p_request_id: 'request-1', p_decision: 'rejected', p_decision_note: null,
    });
  });

  it('updates a member position through the membership UUID RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { ...member, position: 'President' }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(updateAdviserMemberPosition('membership-1', 'President'))
      .resolves.toMatchObject({ ok: true, data: { id: 'membership-1', position: 'President' } });
    expect(client.rpc).toHaveBeenCalledWith('update_adviser_member_position', {
      p_membership_id: 'membership-1', p_position: 'President',
    });
  });

  it('removes a member through the membership UUID RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { ...member, status: 'removed' }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(removeAdviserMember('membership-1'))
      .resolves.toMatchObject({ ok: true, data: { id: 'membership-1', status: 'removed' } });
    expect(client.rpc).toHaveBeenCalledWith('remove_adviser_member', { p_membership_id: 'membership-1' });
  });

  it.each([
    ['not_found', 'not_found'],
    ['forbidden', 'forbidden'],
    ['conflict', 'conflict'],
    ['validation_failed', 'validation_failed'],
    ['permission denied', 'forbidden'],
    ['internal error', 'network'],
  ] as const)('maps the database error %s to %s without exposing details', async (message, code) => {
    mocks.getSupabaseClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: message === 'permission denied' ? '42501' : 'P0001', message } }),
    });

    const result = await listAdviserOrgRequests();

    expect(result).toEqual({ ok: false, error: { code } });
    expect(JSON.stringify(result)).not.toContain('internal error');
  });

  it('returns network for a rejected RPC call', async () => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(listAdviserOrgRequests()).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });

  it('rejects malformed list rows and DTOs', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [{ ...request, status: 'unknown' }], error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(listAdviserOrgRequests()).resolves.toEqual({ ok: false, error: { code: 'network' } });
    client.rpc.mockResolvedValue({ data: [{ ...member, category: 'participant' }], error: null });
    await expect(listAdviserOrgMembers()).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });

  it('accepts an adviser directory entry without a student ID', async () => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [adviser], error: null }) });

    await expect(listAdviserOrgMembers()).resolves.toEqual({ ok: true, data: [adviser] });
  });
});
