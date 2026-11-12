import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerTime: vi.fn() }));
vi.mock('../api/client', () => ({ api: { getServerTime: mocks.getServerTime } }));

import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    mocks.getServerTime.mockReset();
  });

  afterEach(() => vi.useRealTimers());

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
});
