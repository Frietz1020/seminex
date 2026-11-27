import { api } from '../api/client';

/** Periodic background drift resync cadence while at least one consumer is mounted. */
export const DRIFT_RESYNC_MS = 5 * 60_000;
/** Maximum age before tab resume / reconnect triggers a fresh sample. */
export const RESUME_STALE_MS = 30_000;
/** Divergence between wall clock and monotonic clock that indicates OS sleep/suspend. */
export const SLEEP_JUMP_THRESHOLD_MS = 5_000;

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 15_000, 30_000] as const;

type ClockAnchor = {
  serverEpochMs: number;
  syncedPerfMs: number;
  syncedWallMs: number;
};

type SyncOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

let anchor: ClockAnchor | null = null;
let inFlight: Promise<number | null> | null = null;
let inFlightSeq = 0;
let requestSeq = 0;
let latestCommittedSeq = 0;
let retryIndex = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let driftTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;

const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  for (const listener of subscribers) {
    listener();
  }
}

function clearRetryTimer(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function clearDriftTimer(): void {
  if (driftTimer !== null) {
    clearInterval(driftTimer);
    driftTimer = null;
  }
}

function hasSleepJump(current: ClockAnchor): boolean {
  const perfElapsed = performance.now() - current.syncedPerfMs;
  const wallElapsed = Date.now() - current.syncedWallMs;
  return Math.abs(wallElapsed - perfElapsed) > SLEEP_JUMP_THRESHOLD_MS;
}

function isStale(maxAgeMs: number): boolean {
  if (!anchor) return true;
  if (hasSleepJump(anchor)) return true;
  const perfElapsed = performance.now() - anchor.syncedPerfMs;
  const wallElapsed = Date.now() - anchor.syncedWallMs;
  return perfElapsed >= maxAgeMs || wallElapsed >= maxAgeMs;
}

function scheduleBootRetry(): void {
  if (anchor !== null || subscribers.size === 0 || retryTimer !== null || inFlight !== null) return;
  const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)]!;
  retryIndex += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (anchor === null && subscribers.size > 0) {
      void syncServerClock({ force: true });
    }
  }, delay);
}

/**
 * Pure read of the current estimated server epoch in ms derived from the last
 * authoritative `get_server_time` sample plus monotonic `performance.now()` elapsed time.
 * Returns `null` when unanchored or when an OS sleep/suspend jump has invalidated the anchor.
 */
export function getEstimatedServerNow(): number | null {
  if (!anchor) return null;
  if (hasSleepJump(anchor)) return null;
  const elapsed = Math.max(0, performance.now() - anchor.syncedPerfMs);
  return Math.round(anchor.serverEpochMs + elapsed);
}

/**
 * Checks whether the current anchor was invalidated by OS sleep/suspend.
 * Call from effects or interval ticks (never during render) so stale anchors are
 * cleared and a deduplicated resync is triggered.
 */
export function checkServerClock(): number | null {
  if (anchor && hasSleepJump(anchor)) {
    anchor = null;
    notifySubscribers();
    void syncServerClock({ maxAgeMs: RESUME_STALE_MS });
    return null;
  }
  return getEstimatedServerNow();
}

/**
 * Synchronizes the shared clock with Postgres `get_server_time`.
 * Deduplicates concurrent in-flight requests unless `force` is explicitly set.
 */
export function syncServerClock(options: SyncOptions = {}): Promise<number | null> {
  const { force = false, maxAgeMs = DRIFT_RESYNC_MS } = options;

  if (anchor && hasSleepJump(anchor)) {
    anchor = null;
    notifySubscribers();
  }

  if (!force && !isStale(maxAgeMs)) {
    return Promise.resolve(getEstimatedServerNow());
  }

  if (!force && inFlight) {
    return inFlight;
  }

  clearRetryTimer();
  const seq = ++requestSeq;
  inFlightSeq = seq;
  const reqStartPerf = performance.now();

  const request = (async (): Promise<number | null> => {
    try {
      const result = await api.getServerTime();
      const reqEndPerf = performance.now();
      const rttHalf = Math.max(0, (reqEndPerf - reqStartPerf) / 2);
      const timestamp = result.ok ? Date.parse(result.data.now) : Number.NaN;

      if (Number.isFinite(timestamp)) {
        if (seq > latestCommittedSeq) {
          latestCommittedSeq = seq;
          anchor = {
            serverEpochMs: timestamp,
            syncedPerfMs: reqStartPerf + rttHalf,
            syncedWallMs: Date.now() - rttHalf,
          };
          retryIndex = 0;
          clearRetryTimer();
          notifySubscribers();
        }
        return getEstimatedServerNow();
      }
    } catch {
      // Keep previous anchor (or null) on transport error.
    }

    if (inFlightSeq === seq) {
      inFlight = null;
    }
    if (anchor === null && !inFlight) {
      scheduleBootRetry();
    }
    return getEstimatedServerNow();
  })();

  inFlight = request;
  void request.finally(() => {
    if (inFlightSeq === seq) {
      inFlight = null;
    }
  });

  return request;
}

function handleVisibilityChange(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void syncServerClock({ maxAgeMs: RESUME_STALE_MS });
  }
}

function handleOnline(): void {
  void syncServerClock({ force: anchor === null, maxAgeMs: RESUME_STALE_MS });
}

function attachGlobalListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }
  driftTimer = setInterval(() => {
    void syncServerClock({ maxAgeMs: DRIFT_RESYNC_MS });
  }, DRIFT_RESYNC_MS);
}

function detachGlobalListeners(): void {
  if (!listenersAttached) return;
  listenersAttached = false;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
  }
  clearDriftTimer();
  clearRetryTimer();
}

/** Subscribes to authoritative clock updates and manages shared lifecycle listeners. */
export function subscribeServerClock(listener: () => void): () => void {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    attachGlobalListeners();
  }
  if (isStale(DRIFT_RESYNC_MS)) {
    void syncServerClock({ maxAgeMs: DRIFT_RESYNC_MS });
  }
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      detachGlobalListeners();
    }
  };
}

/** Resets all module state for isolated unit tests. */
export function resetServerClockForTests(): void {
  subscribers.clear();
  detachGlobalListeners();
  anchor = null;
  inFlight = null;
  inFlightSeq = 0;
  latestCommittedSeq = ++requestSeq;
  retryIndex = 0;
}
