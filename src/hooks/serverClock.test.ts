// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerTime: vi.fn() }));
vi.mock('../api/client', () => ({ api: { getServerTime: mocks.getServerTime } }));

import {
  checkServerClock,
  DRIFT_RESYNC_MS,
  getEstimatedServerNow,
  resetServerClockForTests,
  subscribeServerClock,
  syncServerClock,
} from './serverClock';

type ListenerMap = Map<string, Set<EventListener>>;

function createFakeTargets() {
  const winListeners: ListenerMap = new Map();
  const docListeners: ListenerMap = new Map();
  let visibilityState: DocumentVisibilityState = 'visible';

  const fakeWindow = {
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      winListeners.get(type)?.delete(cb);
    }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    dispatch(type: string) {
      for (const cb of winListeners.get(type) ?? []) cb(new Event(type));
    },
    listenerCount(type: string) {
      return winListeners.get(type)?.size ?? 0;
    },
  };

  const fakeDocument = {
    get visibilityState() {
      return visibilityState;
    },
    setVisibilityState(next: DocumentVisibilityState) {
      visibilityState = next;
    },
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      docListeners.get(type)?.delete(cb);
    }),
    dispatch(type: string) {
      for (const cb of docListeners.get(type) ?? []) cb(new Event(type));
    },
    listenerCount(type: string) {
      return docListeners.get(type)?.size ?? 0;
    },
  };

  return { fakeWindow, fakeDocument };
}

describe('serverClock', () => {
  let fakeWindow: ReturnType<typeof createFakeTargets>['fakeWindow'];
  let fakeDocument: ReturnType<typeof createFakeTargets>['fakeDocument'];
  let perfNow = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T10:00:00.000Z'));
    perfNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
    const targets = createFakeTargets();
    fakeWindow = targets.fakeWindow;
    fakeDocument = targets.fakeDocument;
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', fakeDocument);
    mocks.getServerTime.mockReset();
    resetServerClockForTests();
  });

  afterEach(() => {
    resetServerClockForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('deduplicates concurrent syncServerClock() calls into a single RPC', async () => {
    let resolveRpc: ((value: { ok: true; data: { now: string } }) => void) | undefined;
    mocks.getServerTime.mockReturnValue(new Promise((resolve) => { resolveRpc = resolve; }));

    const p1 = syncServerClock();
    const p2 = syncServerClock();
    const p3 = syncServerClock();

    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);

    resolveRpc?.({ ok: true, data: { now: '2026-11-27T10:00:00.000Z' } });
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    const expected = Date.parse('2026-11-27T10:00:00.000Z');
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
    expect(r3).toBe(expected);
  });

  it('advances getEstimatedServerNow() monotonically via performance.now() without extra RPCs', async () => {
    const serverIso = '2026-11-27T10:00:00.000Z';
    mocks.getServerTime.mockResolvedValue({ ok: true, data: { now: serverIso } });

    await syncServerClock();
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
    expect(getEstimatedServerNow()).toBe(Date.parse(serverIso));

    perfNow += 12_500;
    vi.setSystemTime(Date.parse(serverIso) + 12_500);
    expect(getEstimatedServerNow()).toBe(Date.parse(serverIso) + 12_500);

    await syncServerClock();
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
  });

  it('stays null and retries with bounded backoff on initial failure, and retries immediately on online', async () => {
    mocks.getServerTime
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-27T10:00:05.000Z' } });

    const listener = vi.fn();
    const unsubscribe = subscribeServerClock(listener);
    await vi.advanceTimersByTimeAsync(0);
    expect(getEstimatedServerNow()).toBeNull();
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);

    // First retry fires at 1_000ms
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(2);
    expect(getEstimatedServerNow()).toBeNull();

    // Online event triggers immediate retry without waiting for 2_000ms backoff
    fakeWindow.dispatch('online');
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(3);
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T10:00:05.000Z'));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('detects OS sleep/suspend jump when Date.now() advances past performance.now() and resyncs on visibilitychange', async () => {
    mocks.getServerTime
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-27T10:00:00.000Z' } })
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-27T12:00:00.000Z' } });

    const unsubscribe = subscribeServerClock(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);

    // Simulate 2-hour laptop sleep: Date.now() jumped +2h, performance.now() paused (+2s)
    perfNow += 2_000;
    vi.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));
    fakeDocument.setVisibilityState('visible');
    fakeDocument.dispatch('visibilitychange');
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.getServerTime).toHaveBeenCalledTimes(2);
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T12:00:00.000Z'));

    unsubscribe();
  });

  it('ignores out-of-order stale sync responses using requestSeq', async () => {
    let resolveFirst: ((value: { ok: true; data: { now: string } }) => void) | undefined;
    let resolveSecond: ((value: { ok: true; data: { now: string } }) => void) | undefined;

    mocks.getServerTime
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    const first = syncServerClock({ force: true });
    const second = syncServerClock({ force: true });

    resolveSecond?.({ ok: true, data: { now: '2026-11-27T10:05:00.000Z' } });
    await second;
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T10:05:00.000Z'));

    resolveFirst?.({ ok: true, data: { now: '2026-11-27T10:00:00.000Z' } });
    await first;
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T10:05:00.000Z'));
  });

  it('cleans up drift timer and global listeners when last subscriber unsubscribes', async () => {
    mocks.getServerTime.mockResolvedValue({ ok: true, data: { now: '2026-11-27T10:00:00.000Z' } });

    const unsub1 = subscribeServerClock(() => {});
    const unsub2 = subscribeServerClock(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
    expect(fakeDocument.listenerCount('visibilitychange')).toBe(1);
    expect(fakeWindow.listenerCount('online')).toBe(1);

    unsub1();
    expect(fakeDocument.listenerCount('visibilitychange')).toBe(1);

    unsub2();
    expect(fakeDocument.listenerCount('visibilitychange')).toBe(0);
    expect(fakeWindow.listenerCount('online')).toBe(0);

    // Advancing past drift resync interval after full unsubscribe triggers no RPCs
    perfNow += DRIFT_RESYNC_MS + 10_000;
    await vi.advanceTimersByTimeAsync(DRIFT_RESYNC_MS + 10_000);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
  });

  it('invalidates anchor on sleep jump so stale time is never returned and engages backoff when wake resync fails', async () => {
    mocks.getServerTime
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-27T10:00:00.000Z' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: true, data: { now: '2026-11-27T12:00:05.000Z' } });

    const unsubscribe = subscribeServerClock(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T10:00:00.000Z'));

    // Simulate 2-hour sleep while performance.now() paused (+1s)
    perfNow += 1_000;
    vi.setSystemTime(new Date('2026-11-27T12:00:00.000Z'));

    // Pure read returns null instead of 2-hour-stale timestamp
    expect(getEstimatedServerNow()).toBeNull();
    // Tick check triggers wake resync (which fails)
    expect(checkServerClock()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(2);
    expect(getEstimatedServerNow()).toBeNull();

    // Backoff retry fires after 1_000ms and recovers
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(3);
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T12:00:05.000Z'));

    unsubscribe();
  });

  it('does not trigger a false sleep jump after a slow (>10s) RPC round-trip', async () => {
    let resolveRpc: ((value: { ok: true; data: { now: string } }) => void) | undefined;
    mocks.getServerTime.mockReturnValueOnce(new Promise((resolve) => { resolveRpc = resolve; }));

    const pending = syncServerClock();
    // Simulate 12-second network round-trip
    perfNow += 12_000;
    vi.setSystemTime(new Date('2026-11-27T10:00:12.000Z'));
    resolveRpc?.({ ok: true, data: { now: '2026-11-27T10:00:06.000Z' } });
    await pending;

    // Estimated time should be valid (not null) and not trigger another RPC
    expect(getEstimatedServerNow()).toBe(Date.parse('2026-11-27T10:00:12.000Z'));
    await syncServerClock();
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
  });
});
