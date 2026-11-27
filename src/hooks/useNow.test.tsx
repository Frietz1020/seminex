import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerTime: vi.fn() }));
vi.mock('../api/client', () => ({ api: { getServerTime: mocks.getServerTime } }));

import { resetServerClockForTests } from './serverClock';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    mocks.getServerTime.mockReset();
    resetServerClockForTests();
  });

  afterEach(() => {
    resetServerClockForTests();
    vi.useRealTimers();
  });

  it('keeps Supabase time unavailable on failure and retries for an authoritative sample', async () => {
    mocks.getServerTime
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-09T10:00:05.000Z' } });

    const { result } = renderHook(() => useNow(1000));
    expect(result.current).toBeNull();
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current).toBe(Date.parse('2026-11-09T10:00:05.000Z'));
  });

  it('shares a single get_server_time RPC across simultaneous hooks and advances locally without extra RPCs', async () => {
    const startIso = '2026-11-09T10:00:00.000Z';
    mocks.getServerTime.mockResolvedValue({ ok: true, data: { now: startIso } });

    const h1 = renderHook(() => useNow(1000));
    const h2 = renderHook(() => useNow(1000));
    const h3 = renderHook(() => useNow(30_000));

    await act(async () => { await Promise.resolve(); });
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
    expect(h1.result.current).toBe(Date.parse(startIso));
    expect(h2.result.current).toBe(Date.parse(startIso));
    expect(h3.result.current).toBe(Date.parse(startIso));

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
    expect(h1.result.current).toBeGreaterThanOrEqual(Date.parse(startIso) + 9_000);
    expect(h2.result.current).toBeGreaterThanOrEqual(Date.parse(startIso) + 9_000);
  });
});
