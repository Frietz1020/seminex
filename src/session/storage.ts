/**
 * Session storage for the MOCK API. In production the server sets an httpOnly cookie and
 * the browser holds no token. This store also lets the route guard and API layer share
 * one source of truth through useSyncExternalStore.
 */
import type { Session, SessionRole } from '../api/types';

const KEY = 'seminex.session';

const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastValue: Session | null = null;
let expired = false;
let memoryFallback: string | null = null;

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session>;
    if (
      typeof value.studentId === 'string' &&
      typeof value.token === 'string' &&
      typeof value.expiresAt === 'number'
    ) {
      // A session saved before roles existed is a participant session.
      const role: SessionRole =
        value.role === 'org_member' || value.role === 'adviser' ? value.role : 'participant';
      const organizationIds = Array.isArray(value.organizationIds)
        ? value.organizationIds.filter((id): id is string => typeof id === 'string')
        : [];
      return { studentId: value.studentId, token: value.token, expiresAt: value.expiresAt, role, organizationIds };
    }
  } catch {
    // Treated as no session.
  }
  return null;
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memoryFallback;
  }
}

function writeRaw(raw: string | null): void {
  memoryFallback = raw;
  try {
    if (raw === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, raw);
  } catch {
    // Storage unavailable: the in-memory copy keeps this tab working.
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Returns the same object until the stored value changes, as useSyncExternalStore requires. */
export function getSession(): Session | null {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = parse(raw);
  }
  return lastValue;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function saveSession(session: Session): void {
  expired = false;
  writeRaw(JSON.stringify(session));
  notify();
}

export function clearSession(): void {
  writeRaw(null);
  notify();
}

/** Ends the session because it expired, so the sign-in page can say so. */
export function expireSession(): void {
  expired = true;
  clearSession();
}

export function wasExpired(): boolean {
  return expired;
}