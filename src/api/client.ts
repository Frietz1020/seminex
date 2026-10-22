/**
 * The only module components import for data access. To connect the real API,
 * replace the functions imported from ./mock. Components do not change.
 *
 * This module also owns the offline fallback: when a call fails with "network", it returns
 * the cached copy (marked fromCache) if one exists. Only registered seminars, their tickets,
 * and the profile are cached. The org side follows the same rule with its own cache (orgOfflineCache.ts).
 */
import { clearSession, getSession } from '../session/storage';
import * as impl from './mock';
import * as orgImpl from './orgMock';
import {
  cacheOrgIdentity,
  cacheOrgLedger,
  cacheOrgListing,
  cacheOrgRoster,
  clearOrgOfflineCache,
  readOrgIdentity,
  readOrgLedger,
  readOrgListing,
  readOrgRoster,
  readQueuedScans,
  removeQueuedScans,
} from './orgOfflineCache';
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
import type {
  OrgIdentity,
  OrgRegistration,
  OrgSeminarListing,
  OrgSignUpInput,
  ScanLedgerEntry,
} from './orgTypes';
import type {
  ApiResult,
  AvatarResult,
  EditableProfile,
  Profile,
  SeminarListItem,
  SignUpInput,
  SignUpResult,
  Ticket,
} from './types';

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
    if (student) {
      clearOfflineCache(student);
      clearOrgOfflineCache(student);
    }
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

// ---- Org side ---------------------------------------------------------------------
// Same pattern as above: a network failure returns the saved copy, marked fromCache, when one exists.

/**
 * Creates the student account, then the organization request. The request cannot be made without the
 * account, so a real API should take both in one call; the mock needs two.
 */
async function orgSignUp(input: SignUpInput, organization: OrgSignUpInput): Promise<ApiResult<SignUpResult>> {
  const created = await impl.signUp(input);
  if (!created.ok) return created;
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const request = await orgImpl.createOrgRequest(input.studentId, fullName, organization);
  if (!request.ok) return request;
  return created;
}

async function submitOrgAccessRequest(input: OrgSignUpInput & { fullName: string }): Promise<ApiResult<import('./orgTypes').OrgRequest>> {
  const session = getSession();
  if (!session) return { ok: false, error: { code: 'session_expired' } };
  if (session.role === 'adviser') return { ok: false, error: { code: 'forbidden' } };
  return orgImpl.createOrgRequest(session.studentId, input.fullName, input);
}

async function getOrgIdentity(): Promise<ApiResult<OrgIdentity>> {
  const result = await orgImpl.getOrgIdentity();
  const account = currentStudent();
  if (!account) return result;
  if (result.ok) {
    cacheOrgIdentity(account, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const identity = readOrgIdentity(account);
    if (identity) return cached(identity);
  }
  return result;
}

async function listOrgSeminars(): Promise<ApiResult<OrgSeminarListing>> {
  const result = await orgImpl.listOrgSeminars();
  const account = currentStudent();
  if (!account) return result;
  if (result.ok) {
    cacheOrgListing(account, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const listing = readOrgListing(account);
    if (listing) return cached(listing);
  }
  return result;
}

async function listOrgRoster(seminarId: string): Promise<ApiResult<OrgRegistration[]>> {
  const result = await orgImpl.listOrgRoster(seminarId);
  const account = currentStudent();
  if (!account) return result;
  if (result.ok) {
    cacheOrgRoster(account, seminarId, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const roster = readOrgRoster(account, seminarId);
    if (roster) return cached(roster);
  }
  return result;
}

async function listLedger(seminarId: string): Promise<ApiResult<ScanLedgerEntry[]>> {
  const result = await orgImpl.listLedger(seminarId);
  const account = currentStudent();
  if (!account) return result;
  if (result.ok) {
    cacheOrgLedger(account, seminarId, result.data);
    return result;
  }
  if (result.error.code === 'network') {
    const ledger = readOrgLedger(account, seminarId);
    if (ledger) return cached(ledger);
  }
  return result;
}

/** Sends the scans queued on this device. Entries the server accepted leave the queue; the rest stay. */
async function syncQueuedScans(): Promise<ApiResult<{ synced: number }>> {
  const account = currentStudent();
  if (!account) return { ok: false, error: { code: 'session_expired' } };
  const queued = readQueuedScans(account);
  if (queued.length === 0) return { ok: true, data: { synced: 0 } };
  const result = await orgImpl.syncScans(queued);
  if (!result.ok) return result;
  removeQueuedScans(account, result.data.accepted);
  return { ok: true, data: { synced: result.data.accepted.length } };
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
  orgSignIn: orgImpl.orgSignIn,
  orgSignUp,
  listAdviserOrgRequests: orgImpl.listAdviserOrgRequests,
  decideAdviserOrgRequest: orgImpl.decideAdviserOrgRequest,
  listOrganizations: orgImpl.listOrganizations,
  submitOrgAccessRequest,
  getMyOrgAccessStatus: orgImpl.getMyOrgAccessStatus,
  withdrawMyOrgRequest: orgImpl.withdrawMyOrgRequest,
  getOrgIdentity,
  listOrgSeminars,
  listOrgRoster,
  listLedger,
  syncQueuedScans,
};

export type * from './types';
export type * from './orgTypes';
