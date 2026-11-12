import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { getServerTime } from './serverTime';

describe('Supabase server time adapter', () => {
  beforeEach(() => mocks.getSupabaseClient.mockReset());

  it('reads the authoritative timestamp from the database RPC', async () => {
    const now = '2026-11-09T10:11:12.000Z';
    const client = { rpc: vi.fn().mockResolvedValue({ data: now, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(getServerTime()).resolves.toEqual({ ok: true, data: { now } });
    expect(client.rpc).toHaveBeenCalledWith('get_server_time');
  });

  it('does not fabricate a timestamp when the database returns an invalid value', async () => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(getServerTime()).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });

  it('returns network when the database request fails', async () => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(getServerTime()).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });
});
