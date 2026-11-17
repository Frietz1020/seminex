/**
 * The only module components import for data access. This boundary dispatches
 * Supabase adapters while owning offline fallbacks.
 *
 * This module also owns the offline fallback: when a call fails with "network", it returns
 * the cached copy (marked fromCache) if one exists. Only registered seminars, their tickets,
 * and the profile are cached. The org side follows the same rule with its own cache (orgOfflineCache.ts).
 */
import { clearSession, getSessionIdentity, saveCachedIdentity } from '../session/storage';
import { clearPrivateUserData } from '../session/privateData';
import * as authImpl from './auth';
import * as seminarApi from './seminars';
import * as attendanceApi from './attendance';
import * as evaluationApi from './evaluations';
import * as certificateApi from './certificates';
import * as adviserApi from './adviser';
import * as serverTimeApi from './serverTime';
import {
  cacheOrgIdentity,
  cacheOrgLedger,
  cacheOrgListing,
  cacheOrgRoster,
  readOrgIdentity,
  readOrgLedger,
  readOrgListing,
  readOrgRoster,
} from './orgOfflineCache';
import {
  cacheItem,
  cacheProfile,
  cacheRegisteredItems,
  cacheTicket,
  forgetSeminar,
  readItem,
  readProfile,
  readRegisteredItems,
  readTicket,
} from './offlineCache';
import type {
  OrgIdentity,
  OrgRegistration,
  OrgSignInInput,
  OrgSeminarListingPage,
  OrgSeminarListingRequest,
  OrgSeminarEvaluationData,
  OrgSignUpInput,
  Organization,
  RecordOrgScanInput,
  RecordOrgScanResult,
  ScanLedgerEntry,
} from './orgTypes';
import type {
  ApiResult,
  AvatarResult,
  CursorPage,
  CursorPageRequest,
  EditableProfile,
  Profile,
  SeminarListItem,
  SignInInput,
  SignUpInput,
  SignUpResult,
  Ticket,
} from './types';

function currentStudent(): string | null {
  return getSessionIdentity()?.studentId ?? null;
}

function getServerTime() {
  return serverTimeApi.getServerTime();
}

function signalSessionChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('seminex:session-changed'));
}

function cached<T>(data: T): ApiResult<T> {
  return { ok: true, data, fromCache: true };
}

/** Downloads tickets for registered seminars that have not finished, so they work offline. */
async function prefetchTickets(student: string, items: SeminarListItem[]): Promise<void> {
  const serverTime = await serverTimeApi.getServerTime();
  if (!serverTime.ok) return;
  const now = Date.parse(serverTime.data.now);
  if (!Number.isFinite(now)) return;
  for (const item of items) {
    if (!item.registration) continue;
    if (new Date(item.seminar.endsAt).getTime() <= now) continue;
    if (readTicket(student, item.seminar.id)) continue;
    void seminarApi.getTicket(item.seminar.id).then((result) => {
      if (result.ok) cacheTicket(student, result.data);
    });
  }
}

async function getProfile(): Promise<ApiResult<Profile>> {
  const result = await authImpl.getProfile();
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
  const result = await authImpl.updateProfile(input);
  const student = currentStudent();
  if (student && result.ok) cacheProfile(student, result.data);
  return result;
}

async function uploadAvatar(file: File): Promise<ApiResult<AvatarResult>> {
  const result = await authImpl.uploadAvatar(file);
  const student = currentStudent();
  if (student && result.ok) {
    // The cache keeps only a URL, not the image bytes.
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
    return await authImpl.signOut();
  } finally {
    if (student) {
      await clearPrivateUserData(student);
    }
    clearSession();
    signalSessionChanged();
  }
}

function cachedPage<T>(items: T[]): CursorPage<T> {
  return { items, nextCursor: null };
}

/** Finished registrations after the Home window. Offline reads use saved registration data. */
async function listHistory(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const result = await seminarApi.listHistory(request);
  const student = currentStudent();
  if (!student) return result;
  return result;
}

async function listAvailableSeminars(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const result = await seminarApi.listAvailableSeminars(request);
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    const registered = result.data.items.filter((item) => item.registration !== null);
    cacheRegisteredItems(student, registered);
    void prefetchTickets(student, registered);
    return result;
  }
  if (!request?.cursor && result.error.code === 'network') {
    const saved = readRegisteredItems(student);
    if (saved.length > 0) return cached(cachedPage(saved));
  }
  return result;
}

async function listMySeminars(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const result = await seminarApi.listMySeminars(request);
  const student = currentStudent();
  if (!student) return result;
  if (result.ok) {
    cacheRegisteredItems(student, result.data.items);
    void prefetchTickets(student, result.data.items);
    return result;
  }
  if (!request?.cursor && result.error.code === 'network') {
    const items = readRegisteredItems(student);
    if (items.length > 0) return cached(cachedPage(items));
  }
  return result;
}

/** Legacy non-paginated read retained for the attendance prompt. */
async function listSeminars(): Promise<ApiResult<SeminarListItem[]>> {
  const result = await listMySeminars({ pageSize: 999 });
  return result.ok
    ? { ok: true, data: result.data.items, ...(result.fromCache ? { fromCache: true } : {}) }
    : result;
}

async function getSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const result = await seminarApi.getSeminar(seminarId);
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
  const result = await seminarApi.getTicket(seminarId);
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

async function getTicketPdf(seminarId: string): Promise<ApiResult<Blob>> {
  const ticket = await getTicket(seminarId);
  if (!ticket.ok) return ticket;

  const [profile, item] = await Promise.all([getProfile(), getSeminar(seminarId)]);
  if (!profile.ok) return profile;
  if (!item.ok) return item;
  const registration = item.data.registration;
  if (
    ticket.data.seminarId !== seminarId
    || item.data.seminar.id !== seminarId
    || ticket.data.studentId !== profile.data.studentId
    || !registration
    || (registration.status !== 'registered' && registration.status !== 'confirmed')
  ) return { ok: false, error: { code: 'not_available' } };

  try {
    const { createTicketPdf } = await import('./ticketPdf');
    return {
      ok: true,
      data: await createTicketPdf({
        seminar: item.data.seminar,
        ticket: ticket.data,
        profile: profile.data,
        registration,
      }),
    };
  } catch {
    return { ok: false, error: { code: 'not_available' } };
  }
}

async function registerForSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const result = await seminarApi.registerForSeminar(seminarId);
  const student = currentStudent();
  if (student && result.ok) {
    cacheItem(student, result.data);
    void prefetchTickets(student, [result.data]);
  }
  if (result.ok && typeof window !== 'undefined') window.dispatchEvent(new Event('seminex:registrations-changed'));
  return result;
}

async function cancelRegistration(seminarId: string): Promise<ApiResult<void>> {
  const result = await seminarApi.cancelRegistration(seminarId);
  const student = currentStudent();
  if (student && result.ok) forgetSeminar(student, seminarId);
  if (result.ok && typeof window !== 'undefined') window.dispatchEvent(new Event('seminex:registrations-changed'));
  return result;
}

async function confirmRegistration(seminarId: string) {
  const result = await seminarApi.confirmRegistration(seminarId);
  if (result.ok && typeof window !== 'undefined') window.dispatchEvent(new Event('seminex:registrations-changed'));
  return result;
}

async function acknowledgeAttendance(seminarId: string) {
  const result = await attendanceApi.acknowledgeAttendance(seminarId);
  if (result.ok && typeof window !== 'undefined') window.dispatchEvent(new Event('seminex:registrations-changed'));
  return result;
}

// ---- Org side ---------------------------------------------------------------------
// Same pattern as above: a network failure returns the saved copy, marked fromCache, when one exists.

/**
 * Creates the student account and organization request in one Supabase transaction.
 */
async function orgSignUp(input: SignUpInput, organization: OrgSignUpInput): Promise<ApiResult<SignUpResult>> {
  const result = await authImpl.completeOrganizationSignup(input, organization);
  if (result.ok) {
    clearSession();
    signalSessionChanged();
  }
  return result;
}

async function submitOrgAccessRequest(input: OrgSignUpInput & { fullName: string }): Promise<ApiResult<import('./orgTypes').OrgRequest>> {
  return authImpl.submitOrgAccessRequest(input);
}

function getMyOrgAccessStatus() {
  return authImpl.getMyOrgAccessStatus();
}

function withdrawMyOrgRequest() {
  return authImpl.withdrawOrgAccessRequest();
}

async function getOrgIdentity(): Promise<ApiResult<OrgIdentity>> {
  const result = await authImpl.getOrgIdentity();
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

async function listOrgSeminars(request?: OrgSeminarListingRequest): Promise<ApiResult<OrgSeminarListingPage>> {
  const result = await seminarApi.listOrgSeminars(request);
  const account = currentStudent();
  if (!account) return result;
  if (result.ok) {
    const previous = readOrgListing(account);
    cacheOrgListing(account, {
      seminars: request?.seminars?.cursor ? previous?.seminars ?? [] : result.data.seminars.items,
      drafts: request?.drafts?.cursor ? previous?.drafts ?? [] : result.data.drafts.items,
    });
    return result;
  }
  if (!request?.seminars?.cursor && !request?.drafts?.cursor && result.error.code === 'network') {
    const listing = readOrgListing(account);
    if (listing) return cached({
      seminars: cachedPage(listing.seminars),
      drafts: cachedPage(listing.drafts),
    });
  }
  return result;
}

async function listOrgRoster(seminarId: string): Promise<ApiResult<OrgRegistration[]>> {
  const result = await attendanceApi.listOrgRoster(seminarId);
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
  const result = await attendanceApi.listLedger(seminarId);
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

async function createOrgDraft() {
  const result = await seminarApi.createOrgDraft();
  if (result.ok) await listOrgSeminars();
  return result;
}

async function createOrgEditDraft(seminarId: string) {
  const result = await seminarApi.createOrgEditDraft(seminarId);
  if (result.ok) await listOrgSeminars();
  return result;
}

async function saveOrgDraft(draft: import('./orgTypes').SeminarDraft) {
  const result = await seminarApi.saveOrgDraft(draft);
  if (result.ok) await listOrgSeminars();
  return result;
}

function uploadOrgSeminarCover(draftId: string, file: File) {
  return seminarApi.uploadOrgSeminarCover(draftId, file);
}

function removeOrgSeminarCover(draftId: string, objectPath: string) {
  return seminarApi.removeOrgSeminarCover(draftId, objectPath);
}

async function publishOrgDraft(draftId: string) {
  const result = await seminarApi.publishOrgDraft(draftId);
  if (result.ok) await listOrgSeminars();
  return result;
}

async function recordOrgScan(input: RecordOrgScanInput): Promise<ApiResult<RecordOrgScanResult>> {
  return attendanceApi.recordOrgScan(input);
}

async function issueAttendanceChallenge(seminarId: string) {
  return attendanceApi.issueAttendanceChallenge(seminarId);
}

async function recordOrgChallengeScan(input: import('./orgTypes').RecordOrgChallengeScanInput): Promise<ApiResult<RecordOrgScanResult>> {
  return attendanceApi.recordOrgChallengeScan(input);
}

function uploadWebinarProof(seminarId: string, kind: import('./types').ProofKind, file: File) {
  return attendanceApi.uploadWebinarProof(seminarId, kind, file);
}

function listMyWebinarProofs(seminarId: string) {
  return attendanceApi.listMyWebinarProofs(seminarId);
}

function listWebinarProofs(seminarId: string) {
  return attendanceApi.listWebinarProofs(seminarId);
}

function reviewWebinarProof(proofId: string, approve: boolean, reason?: string) {
  return attendanceApi.reviewWebinarProof(proofId, approve, reason);
}

async function getSession() {
  return authImpl.getCurrentIdentity();
}

async function signIn(input: SignInInput) {
  const result = await authImpl.signIn(input);
  if (result.ok) {
    saveCachedIdentity(result.data);
    signalSessionChanged();
  }
  return result;
}

async function signUp(input: SignUpInput) {
  const result = await authImpl.completeStudentSignup(input);
  if (result.ok) {
    clearSession();
    signalSessionChanged();
  }
  return result;
}

function sendSignupOtp(studentId: string, password: string) {
  return authImpl.sendSignupOtp(studentId, password);
}

async function verifySignupOtp(studentId: string, code: string) {
  const result = await authImpl.verifySignupOtp(studentId, code);
  if (result.ok) {
    const identity = await authImpl.getCurrentIdentity();
    if (identity.ok && identity.data) saveCachedIdentity(identity.data);
    signalSessionChanged();
  }
  return result;
}

function resendVerification(email: string) {
  return authImpl.resendSignupOtp(email);
}

async function orgSignIn(input: OrgSignInInput) {
  const result = await authImpl.orgSignIn(input);
  if (result.ok) signalSessionChanged();
  return result;
}

function sendPasswordResetOtp(studentId: string) {
  return authImpl.sendPasswordResetOtp(studentId);
}

function verifyPasswordResetOtp(studentId: string, code: string) {
  return authImpl.verifyPasswordResetOtp(studentId, code);
}

async function resetPassword(studentId: string, password: string) {
  const result = await authImpl.resetPassword(studentId, password);
  if (result.ok) {
    clearSession();
    signalSessionChanged();
  }
  return result;
}

function listOrganizations(): Promise<ApiResult<Organization[]>> {
  return authImpl.listOrganizations();
}

function listEvaluationsDue() {
  return evaluationApi.listEvaluationsDue();
}

function getEvaluationSurvey(seminarId: string) {
  return evaluationApi.getEvaluationSurvey(seminarId);
}

function submitEvaluation(seminarId: string, surveyId: string, surveyVersion: number, answers: import('./types').EvaluationAnswers) {
  return evaluationApi.submitEvaluation(seminarId, surveyId, surveyVersion, answers);
}

function getOrgSeminarEvaluation(seminarId: string, request?: CursorPageRequest): Promise<ApiResult<OrgSeminarEvaluationData>> {
  return evaluationApi.getOrgSeminarEvaluation(seminarId, request);
}

export const api = {
  signIn,
  signUp,
  sendSignupOtp,
  verifySignupOtp,
  resendVerification,
  getServerTime,
  getSession,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  getProfile,
  updateProfile,
  uploadAvatar,
  signOut,
  listHistory,
  listAvailableSeminars,
  listMySeminars,
  listSeminars,
  getSeminar,
  registerForSeminar,
  cancelRegistration,
  confirmRegistration,
  acknowledgeAttendance,
  uploadWebinarProof,
  listMyWebinarProofs,
  getTicket,
  listEvaluationsDue,
  getTicketPdf,
  getCertificate: certificateApi.getCertificate,
  getEvaluationSurvey,
  submitEvaluation,
  orgSignIn,
  orgSignUp,
  listAdviserOrgRequests: adviserApi.listAdviserOrgRequests,
  listAdviserOrgMembers: adviserApi.listAdviserOrgMembers,
  updateAdviserMemberPosition: adviserApi.updateAdviserMemberPosition,
  removeAdviserMember: adviserApi.removeAdviserMember,
  decideAdviserOrgRequest: adviserApi.decideAdviserOrgRequest,
  listOrganizations,
  submitOrgAccessRequest,
  getMyOrgAccessStatus,
  withdrawMyOrgRequest,
  getOrgIdentity,
  listOrgSeminars,
  listOrgRoster,
  listLedger,
  getOrgSeminarEvaluation,
  getOrgSeminarCertificates: certificateApi.getOrgSeminarCertificates,
  getOrgCertificate: certificateApi.getOrgCertificate,
  createOrgDraft,
  createOrgEditDraft,
  saveOrgDraft,
  uploadOrgSeminarCover,
  removeOrgSeminarCover,
  publishOrgDraft,
  recordOrgScan,
  issueAttendanceChallenge,
  recordOrgChallengeScan,
  listWebinarProofs,
  reviewWebinarProof,
};

export type * from './types';
export type * from './orgTypes';
