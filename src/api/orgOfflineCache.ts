/**
 * Offline cache for the signed-in org account: identity, seminar lists, rosters, and ledgers. Attendance
 * changes require a connection and are never cached for later submission. Kept apart from offlineCache.ts, which holds
 * the student side.
 *
 * Mechanism: one localStorage entry per account ("seminex.org.offline.v1.<accountId>"). The account id is
 * the Student ID, or the faculty email for an adviser. Writes are best effort. Everything is removed when the
 * person signs out.
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
  /** Read-only copies of server ledger entries by seminar id. */
  ledgers: Record<string, import('./orgTypes').ScanLedgerEntry[]>;
}

const key = (accountId: string) => `seminex.org.offline.v1.${accountId}`;

function empty(): OrgCache {
  return { version: 1, cachedAt: new Date().toISOString(), rosters: {}, ledgers: {} };
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

/** Removes cached org identity and read-only data when signing out. */
export function clearOrgOfflineCache(accountId: string): void {
  try {
    window.localStorage.removeItem(key(accountId));
  } catch {
    // Nothing to do.
  }
}
