/**
 * The only module components import for data access. To connect the real API,
 * replace the functions imported from ./mock. Components do not change.
 *
 * This module also owns the offline fallback: when a call fails with "network", it returns
 * the cached copy (marked fromCache) if one exists. Only registered seminars, their tickets,
 * and the profile are cached.
 */
import { clearSession, getSession } from '../session/storage';
import * as impl from './mock';
import {
  cacheItem,
  cacheProfile,
  cacheRegisteredItems,
  cacheTicket,
  clearOfflineCache,
  forgetSeminar,
  readItem,
  readProfile,
  readRegisteredItems,
  readTicket,
} from './offlineCache';
import { getLifecycle } from '../features/seminars/status';
import type { ApiResult, AvatarResult, EditableProfile, Profile, SeminarListItem, Ticket } from './types';

function currentStudent(): string | null {
  return getSession()?.studentId ?? null;
}

function cached<T>(data: T): ApiResult<T> {
  return { ok: true, data, fromCache: true };
}

/** Downloads tickets for registered seminars that have not finished, so they work offline. */
function prefetchTickets(student: string, items: SeminarListItem[]): void {
  const now = Date.now();
  for (const item of items) {
    if (!item.registration) continue;
    if (new Date(item.seminar.endsAt).getTime() <= now) continue;
    if (readTicket(student, item.seminar.id)) continue;
    void impl.getTicket(item.seminar.id).then((result) => {
      if (result.ok) cacheTicket(student, result.data);
    });
  }
}

async function getProfile(): Promise<ApiResult<Profile>> {
  const result = await impl.getProfile();
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    cacheProfile(student, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const profile = readProfile(student);
    if (profile) return cached(profile);
  }
  return result;
}

async function updateProfile(input: EditableProfile): Promise<ApiResult<Profile>> {
  const result = await impl.updateProfile(input);
  const student = currentStudent();
  if (student && result.ok) cacheProfile(student, result.data);
  return result;
}

async function uploadAvatar(file: File): Promise<ApiResult<AvatarResult>> {
  const result = await impl.uploadAvatar(file);
  const student = currentStudent();
  if (student && result.ok) {
    // The cache keeps only an address, so an object URL from the mock will not survive a reload.
    const profile = readProfile(student);
    if (profile) cacheProfile(student, { ...profile, avatarUrl: result.data.avatarUrl });
  }
  return result;
}

/**
 * Ends the session on the server, then clears the session and everything held for this student
 * on this device (profile, tickets and QR payloads, evaluation drafts), even if the server call
 * fails. A student who signs out offline is still signed out here.
 */
async function signOut(): Promise<ApiResult<void>> {
  const student = currentStudent();
  try {
    return await impl.signOut();
  } finally {
    if (student) clearOfflineCache(student);
    clearSession();
  }
}

/** Finished seminars the student registered for. Offline, the saved registered seminars are filtered the same way. */
async function listHistory(): Promise<ApiResult<SeminarListItem[]>> {
  const result = await impl.listHistory();
  const student = currentStudent();
  if (!student) return result;
  if (!result.ok && result.error.code === 'network') {
    const now = Date.now();
    const saved = readRegisteredItems(student).filter((item) => getLifecycle(item.seminar, now) === 'finished');
    if (saved.length > 0) return cached(saved);
  }
  return result;
}

async function listSeminars(): Promise<ApiResult<SeminarListItem[]>> {
  const result = await impl.listSeminars();
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    cacheRegisteredItems(student, result.data);
    prefetchTickets(student, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const items = readRegisteredItems(student);
    if (items.length > 0) return cached(items);
  }
  return result;
}

async function getSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const result = await impl.getSeminar(seminarId);
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    cacheItem(student, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const item = readItem(student, seminarId);
    if (item) return cached(item);
  }
  return result;
}

async function getTicket(seminarId: string): Promise<ApiResult<Ticket>> {
  const result = await impl.getTicket(seminarId);
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    cacheTicket(student, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const ticket = readTicket(student, seminarId);
    if (ticket) return cached(ticket);
  }
  return result;
}

async function registerForSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const result = await impl.registerForSeminar(seminarId);
  const student = currentStudent();
  if (student && result.ok) {
    cacheItem(student, result.data);
    prefetchTickets(student, [result.data]);
  }
  return result;
}

async function cancelRegistration(seminarId: string): Promise<ApiResult<void>> {
  const result = await impl.cancelRegistration(seminarId);
  const student = currentStudent();
  if (student && result.ok) forgetSeminar(student, seminarId);
  return result;
}

export const api = {
  signIn: impl.signIn,
  signUp: impl.signUp,
  resendVerification: impl.resendVerification,
  getProfile,
  updateProfile,
  uploadAvatar,
  signOut,
  listHistory,
  listSeminars,
  getSeminar,
  registerForSeminar,
  cancelRegistration,
  getTicket,
  listEvaluationsDue: impl.listEvaluationsDue,
  getTicketPdf: impl.getTicketPdf,
  getCertificate: impl.getCertificate,
  getEvaluationSurvey: impl.getEvaluationSurvey,
  submitEvaluation: impl.submitEvaluation,
};

export type * from './types';