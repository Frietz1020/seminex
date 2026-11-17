/**
 * Supabase Auth manages browser token storage; `seminex.identity` is a separate, token-free cache used only to
 * render cached screens offline. This store also lets the app share identity updates through
 * useSyncExternalStore.
 */
import type { Session, SessionIdentity, SessionRole } from '../api/types';

const KEY = 'seminex.session';
const IDENTITY_KEY = 'seminex.identity';

const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastValue: Session | null = null;
let expired = false;
let memoryFallback: string | null = null;
let identityRaw: string | null | undefined;
let identityValue: SessionIdentity | null = null;
let identityMemoryFallback: string | null = null;
let sessionIdentitySource: Session | null | undefined;
let sessionIdentityValue: SessionIdentity | null = null;

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

function parseIdentity(raw: string | null): SessionIdentity | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SessionIdentity>;
    if (
      typeof value.studentId === 'string' &&
      typeof value.expiresAt === 'number' &&
      (value.role === 'participant' || value.role === 'org_member' || value.role === 'adviser') &&
      Array.isArray(value.organizationIds) &&
      value.organizationIds.every((id) => typeof id === 'string') &&
      (value.onboardingComplete === undefined || typeof value.onboardingComplete === 'boolean')
    ) {
      return {
        studentId: value.studentId,
        expiresAt: value.expiresAt,
        role: value.role,
        organizationIds: value.organizationIds,
        onboardingComplete: value.onboardingComplete,
      };
    }
  } catch {
    // Invalid local identity is treated as no cached identity.
  }
  return null;
}

function readIdentityRaw(): string | null {
  try {
    return window.localStorage.getItem(IDENTITY_KEY);
  } catch {
    return identityMemoryFallback;
  }
}

function writeIdentityRaw(raw: string | null): void {
  identityMemoryFallback = raw;
  identityRaw = raw;
  identityValue = parseIdentity(raw);
  try {
    if (raw === null) window.localStorage.removeItem(IDENTITY_KEY);
    else window.localStorage.setItem(IDENTITY_KEY, raw);
  } catch {
    // Keep the safe identity in memory when browser storage is unavailable.
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

/** Returns a token-free cached identity for offline rendering. */
export function getCachedIdentity(): SessionIdentity | null {
  const raw = readIdentityRaw();
  if (raw !== identityRaw) {
    identityRaw = raw;
    identityValue = parseIdentity(raw);
  }
  return identityValue;
}

/** Caches only fields required to render the signed-in shell while offline. */
export function saveCachedIdentity(identity: SessionIdentity): void {
  expired = false;
  writeIdentityRaw(JSON.stringify({
    studentId: identity.studentId,
    expiresAt: identity.expiresAt,
    role: identity.role,
    organizationIds: [...identity.organizationIds],
    onboardingComplete: identity.onboardingComplete,
  }));
  notify();
}

/** The app-facing identity comes from the safe Supabase identity cache. */
export function getSessionIdentity(): SessionIdentity | null {
  const session = getSession();
  if (session) {
    if (session !== sessionIdentitySource) {
      sessionIdentitySource = session;
      sessionIdentityValue = {
        studentId: session.studentId,
        expiresAt: session.expiresAt,
        role: session.role,
        organizationIds: [...session.organizationIds],
      };
    }
    return sessionIdentityValue;
  }
  sessionIdentitySource = null;
  sessionIdentityValue = null;
  return getCachedIdentity();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === IDENTITY_KEY || event.key === null) listener();
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
  writeIdentityRaw(JSON.stringify({
    studentId: session.studentId,
    expiresAt: session.expiresAt,
    role: session.role,
    organizationIds: [...session.organizationIds],
    onboardingComplete: true,
  }));
  notify();
}

export function clearSession(): void {
  writeRaw(null);
  writeIdentityRaw(null);
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
