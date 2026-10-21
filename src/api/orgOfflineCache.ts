/**
 * Offline cache for the signed-in org account: identity, seminar lists, rosters, ledgers, and the
 * queue of scans recorded on this device but not yet sent. Kept apart from offlineCache.ts, which holds
 * the student side.
 *
 * Mechanism: one localStorage entry per account ("seminex.org.offline.v1.<accountId>"). The account id is
 * the Student ID, or the faculty email for an adviser. Writes are best effort. Everything is removed when the
 * person signs out, including queued scans, so the sign-out screen must warn about unsynced scans first.
 */
import type {
  OrgIdentity,
  OrgRegistration,
  OrgSeminarListing,
  ScanLedgerEntry,
} from './orgTypes';

interface OrgCache {
  version: 1;
  cachedAt: string;
  identity?: OrgIdentity;
  listing?: OrgSeminarListing;
  /** Registrations by seminar id. */
  rosters: Record<string, OrgRegistration[]>;
  /** Server ledger entries by seminar id. */
  ledgers: Record<string, ScanLedgerEntry[]>;
  /** Entries recorded on this device and not yet accepted by the server. */
  queue: ScanLedgerEntry[];
}

const key = (accountId: string) => `seminex.org.offline.v1.${accountId}`;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Calls the listener after any write on this page, and after a write from another tab. */
export function subscribeOrgCache(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith('seminex.org.offline.v1.')) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function empty(): OrgCache {
  return { version: 1, cachedAt: new Date().toISOString(), rosters: {}, ledgers: {}, queue: [] };
}

function read(accountId: string): OrgCache {
  try {
    const raw = window.localStorage.getItem(key(accountId));
    if (raw) {
      const parsed = JSON.parse(raw) as OrgCache;
      if (parsed && parsed.version === 1) return parsed;
    }
  } catch {
    // Corrupt or unavailable: start fresh.
  }
  return empty();
}

function write(accountId: string, cache: OrgCache): void {
  try {
    window.localStorage.setItem(key(accountId), JSON.stringify({ ...cache, cachedAt: new Date().toISOString() }));
  } catch {
    // Best effort only.
  }
  notify();
}

export function cacheOrgIdentity(accountId: string, identity: OrgIdentity): void {
  const cache = read(accountId);
  cache.identity = identity;
  write(accountId, cache);
}

export function readOrgIdentity(accountId: string): OrgIdentity | null {
  return read(accountId).identity ?? null;
}

export function cacheOrgListing(accountId: string, listing: OrgSeminarListing): void {
  const cache = read(accountId);
  cache.listing = listing;
  write(accountId, cache);
}

export function readOrgListing(accountId: string): OrgSeminarListing | null {
  return read(accountId).listing ?? null;
}

export function cacheOrgRoster(accountId: string, seminarId: string, roster: OrgRegistration[]): void {
  const cache = read(accountId);
  cache.rosters[seminarId] = roster;
  write(accountId, cache);
}

export function readOrgRoster(accountId: string, seminarId: string): OrgRegistration[] | null {
  return read(accountId).rosters[seminarId] ?? null;
}

export function cacheOrgLedger(accountId: string, seminarId: string, entries: ScanLedgerEntry[]): void {
  const cache = read(accountId);
  cache.ledgers[seminarId] = entries;
  write(accountId, cache);
}

export function readOrgLedger(accountId: string, seminarId: string): ScanLedgerEntry[] | null {
  return read(accountId).ledgers[seminarId] ?? null;
}

// ---- Scan queue ------------------------------------------------------------------

/** Adds an entry recorded on this device. It stays here, marked unsynced, until the server accepts it. */
export function queueScan(accountId: string, entry: ScanLedgerEntry): void {
  const cache = read(accountId);
  if (cache.queue.some((queued) => queued.id === entry.id)) return;
  cache.queue.push({ ...entry, synced: false });
  write(accountId, cache);
}

export function readQueuedScans(accountId: string): ScanLedgerEntry[] {
  return read(accountId).queue;
}

/** A number, so it can be a stable snapshot for useSyncExternalStore. */
export function countQueuedScans(accountId: string): number {
  return read(accountId).queue.length;
}

export function removeQueuedScans(accountId: string, ids: readonly string[]): void {
  const cache = read(accountId);
  const before = cache.queue.length;
  cache.queue = cache.queue.filter((entry) => !ids.includes(entry.id));
  if (cache.queue.length !== before) write(accountId, cache);
}

/** Removes everything held for this account on this device. Called when signing out. */
export function clearOrgOfflineCache(accountId: string): void {
  try {
    window.localStorage.removeItem(key(accountId));
  } catch {
    // Nothing to do.
  }
  notify();
}