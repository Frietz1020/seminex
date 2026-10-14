/**
 * Offline cache for the signed-in student's registered seminars, tickets, profile, and evaluation
 * drafts. Version 2 added the profile's college, enrollment status, and photo; older entries are ignored.
 *
 * Mechanism: one localStorage entry per student ("seminex.offline.v2.<studentId>").
 * The data is a few kilobytes, localStorage needs no dependency, and the QR code is drawn
 * in the browser from the ticket token, so no image has to be cached. Writes are best
 * effort: a full or unavailable store is ignored and the app works online as usual.
 * If the data grows, move this to IndexedDB or a service worker cache.
 */
import type { EvaluationAnswers, Profile, SeminarListItem, Ticket } from './types';

/** An unfinished evaluation, kept only on this device. */
export interface EvaluationDraft {
  surveyId: string;
  surveyVersion: number;
  answers: EvaluationAnswers;
  savedAt: string;
}

interface StudentCache {
  version: 2;
  cachedAt: string;
  profile?: Profile;
  items: Record<string, SeminarListItem>;
  tickets: Record<string, Ticket>;
  /** Evaluation drafts by seminar id. Cleared with everything else on sign out. */
  drafts?: Record<string, EvaluationDraft>;
}

const key = (studentId: string) => `seminex.offline.v2.${studentId}`;

function empty(): StudentCache {
  return { version: 2, cachedAt: new Date().toISOString(), items: {}, tickets: {} };
}

function read(studentId: string): StudentCache {
  try {
    const raw = window.localStorage.getItem(key(studentId));
    if (raw) {
      const parsed = JSON.parse(raw) as StudentCache;
      if (parsed && parsed.version === 2) return parsed;
    }
  } catch {
    // Corrupt or unavailable: start fresh.
  }
  return empty();
}

function write(studentId: string, cache: StudentCache): void {
  try {
    window.localStorage.setItem(key(studentId), JSON.stringify({ ...cache, cachedAt: new Date().toISOString() }));
  } catch {
    // Best effort only.
  }
}

export function cacheProfile(studentId: string, profile: Profile): void {
  const cache = read(studentId);
  cache.profile = profile;
  write(studentId, cache);
}

/** Replaces the cached seminars with the registered ones from a fresh listing. */
export function cacheRegisteredItems(studentId: string, items: SeminarListItem[]): void {
  const cache = read(studentId);
  cache.items = {};
  for (const item of items) {
    if (item.registration) cache.items[item.seminar.id] = item;
  }
  for (const id of Object.keys(cache.tickets)) {
    if (!cache.items[id]) delete cache.tickets[id];
  }
  write(studentId, cache);
}

export function cacheItem(studentId: string, item: SeminarListItem): void {
  if (!item.registration) return;
  const cache = read(studentId);
  cache.items[item.seminar.id] = item;
  write(studentId, cache);
}

export function cacheTicket(studentId: string, ticket: Ticket): void {
  const cache = read(studentId);
  cache.tickets[ticket.seminarId] = ticket;
  write(studentId, cache);
}

export function forgetSeminar(studentId: string, seminarId: string): void {
  const cache = read(studentId);
  delete cache.items[seminarId];
  delete cache.tickets[seminarId];
  write(studentId, cache);
}

export function readProfile(studentId: string): Profile | null {
  return read(studentId).profile ?? null;
}

export function readRegisteredItems(studentId: string): SeminarListItem[] {
  return Object.values(read(studentId).items);
}

export function readItem(studentId: string, seminarId: string): SeminarListItem | null {
  return read(studentId).items[seminarId] ?? null;
}

export function readTicket(studentId: string, seminarId: string): Ticket | null {
  return read(studentId).tickets[seminarId] ?? null;
}

export function cacheEvaluationDraft(studentId: string, seminarId: string, draft: EvaluationDraft): void {
  const cache = read(studentId);
  cache.drafts = { ...cache.drafts, [seminarId]: draft };
  write(studentId, cache);
}

export function readEvaluationDraft(studentId: string, seminarId: string): EvaluationDraft | null {
  return read(studentId).drafts?.[seminarId] ?? null;
}

export function clearEvaluationDraft(studentId: string, seminarId: string): void {
  const cache = read(studentId);
  if (!cache.drafts?.[seminarId]) return;
  delete cache.drafts[seminarId];
  write(studentId, cache);
}

/** Removes everything held for this student on this device. Called when signing out. */
export function clearOfflineCache(studentId: string): void {
  try {
    window.localStorage.removeItem(key(studentId));
  } catch {
    // Nothing to do.
  }
}