/**
 * MOCK API for the org side. Nothing here contacts a server and none of this behavior is confirmed for
 * the real backend. It uses the same ?mock=<outcome> switch, latency, and session check as ./mock.
 *
 * Mock rules: any password signs in. A Student ID that is not a seeded officer signs in as a participant, and
 * the access it gets depends on that student's organization request. Requests made through organization
 * sign-up are kept in this browser only. Everything else resets when the page reloads.
 */
import { STUDENT_EMAIL_DOMAIN } from '../config';
import { getSession } from '../session/storage';
import { currentOutcome, fail, ok, startSession, wait, withSession } from './mock';
import {
  buildOrgMockData,
  findSeedAccess,
  MOCK_ADVISERS,
  MOCK_OFFICERS,
  MOCK_ORGANIZATIONS,
} from './orgMockData';
import type {
  Organization,
  Membership,
  OrgAccess,
  OrgAccessStatusResult,
  OrgIdentity,
  OrgRegistration,
  OrgRequest,
  OrgSeminarListing,
  OrgSignInInput,
  OrgSignInResult,
  OrgSignUpInput,
  ScanLedgerEntry,
  SyncScansResult,
} from './orgTypes';
import type { ApiResult, Session } from './types';

const data = buildOrgMockData(Date.now());
const serverLedger: ScanLedgerEntry[] = [...data.ledger];

const REQUESTS_KEY = 'seminex.mock.orgRequests';
const WITHDRAWN_REQUESTS_KEY = 'seminex.mock.withdrawnOrgRequestIds';
let memoryWithdrawnRequestIds = new Set<string>();

function readStoredRequests(): OrgRequest[] {
  try {
    const raw = window.localStorage.getItem(REQUESTS_KEY);
    if (raw) return JSON.parse(raw) as OrgRequest[];
  } catch {
    // Treated as no stored requests.
  }
  return [];
}

function writeStoredRequests(requests: OrgRequest[]): void {
  try {
    window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  } catch {
    // Storage unavailable: the request lasts until the page is reloaded.
    memoryRequests = requests;
  }
}

let memoryRequests: OrgRequest[] = [];

function allRequests(): OrgRequest[] {
  const withdrawn = readWithdrawnIds();
  const merged = new Map<string, OrgRequest>();
  [...data.requests, ...readStoredRequests(), ...memoryRequests].forEach((request) => merged.set(request.id, request));
  return [...merged.values()].filter((request) => !withdrawn.has(request.id));
}

function readWithdrawnIds(): Set<string> {
  const ids = new Set(memoryWithdrawnRequestIds);
  try {
    const raw = window.localStorage.getItem(WITHDRAWN_REQUESTS_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) ids.add(id);
  } catch {
    // Keep in-memory withdrawals available when browser storage is unavailable.
  }
  return ids;
}

function writeWithdrawnIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(WITHDRAWN_REQUESTS_KEY, JSON.stringify([...ids]));
  } catch {
    memoryWithdrawnRequestIds = new Set(ids);
  }
}

// ---- Auth ------------------------------------------------------------------------

function accessFor(identifier: string, session: Session): OrgAccess {
  if (session.role === 'adviser') return 'adviser';
  if (session.role === 'org_member') return 'organization';
  const latest = allRequests()
    .filter((request) => request.studentId === identifier)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  if (latest?.status === 'approved') return 'organization';
  if (latest?.status === 'pending') return 'pending';
  if (latest?.status === 'rejected') return 'rejected';
  return 'none';
}

// MOCK: fails with invalid_credentials, session_expired, or network when selected. A faculty email that is not
// a seeded adviser fails with invalid_credentials. Otherwise it starts a session and says what it unlocked.
export async function orgSignIn(input: OrgSignInInput): Promise<ApiResult<OrgSignInResult>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'invalid_credentials' || outcome === 'session_expired' || outcome === 'network') {
    return fail(outcome);
  }
  const identifier = input.identifier.trim();
  if (identifier.includes('@') && findSeedAccess(identifier)?.role !== 'adviser') {
    return fail('invalid_credentials');
  }
  const approved = allRequests()
    .filter((request) => request.studentId === identifier && request.status === 'approved')
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  const seedAccess = findSeedAccess(identifier);
  const access = seedAccess ?? (approved ? { role: 'org_member' as const, organizationIds: [approved.organizationId] } : undefined);
  const session = startSession(identifier, access);
  return ok({ access: accessFor(identifier, session) });
}

/** MOCK: adviser queue and decisions are stored in this browser. */
export async function listAdviserOrgRequests(): Promise<ApiResult<OrgRequest[]>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'network') return fail('network');
  const session = getSession();
  if (!session || session.role !== 'adviser') return fail(session ? 'forbidden' : 'session_expired');
  return ok(allRequests()
    .filter((request) => session.organizationIds.includes(request.organizationId))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((request) => ({ ...request })));
}

export async function decideAdviserOrgRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  decisionNote = '',
): Promise<ApiResult<OrgRequest>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'network') return fail('network');
  const session = getSession();
  if (!session || session.role !== 'adviser') return fail(session ? 'forbidden' : 'session_expired');
  const adviser = MOCK_ADVISERS.find((entry) => entry.email.toLowerCase() === session.studentId.toLowerCase());
  if (!adviser) return fail('forbidden');
  const request = allRequests().find((entry) => entry.id === requestId && session.organizationIds.includes(entry.organizationId));
  if (!request) return fail('not_found');
  if (request.status !== 'pending') return fail('forbidden');
  const decided: OrgRequest = {
    ...request,
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedByAdviserId: adviser.id,
    decisionNote: decisionNote.trim() || undefined,
  };
  writeStoredRequests([...readStoredRequests().filter((entry) => entry.id !== requestId), decided]);
  memoryRequests = [...memoryRequests.filter((entry) => entry.id !== requestId), decided];
  return ok({ ...decided });
}

// MOCK: lists the seeded organizations. No session is needed, because sign-up happens before sign-in.
export async function listOrganizations(): Promise<ApiResult<Organization[]>> {
  await wait();
  if (currentOutcome() === 'network') return fail('network');
  return ok(MOCK_ORGANIZATIONS.map((organization) => ({ ...organization })));
}

// MOCK: stores the request in this browser. It does nothing for a Student ID that already has a pending
// request for the same organization, and returns that request instead.
export async function createOrgRequest(
  studentId: string,
  fullName: string,
  input: OrgSignUpInput,
): Promise<ApiResult<OrgRequest>> {
  await wait();
  if (currentOutcome() === 'network') return fail('network');
  const existing = allRequests().find(
    (request) =>
      request.studentId === studentId && request.organizationId === input.organizationId && request.status === 'pending',
  );
  if (existing) return ok(existing);
  const request: OrgRequest = {
    id: `req-${Date.now().toString(36)}`,
    studentId,
    fullName,
    organizationId: input.organizationId,
    position: input.position,
    statement: input.statement?.trim() || undefined,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  writeStoredRequests([...readStoredRequests(), request]);
  return ok(request);
}

/** MOCK: the latest request and membership state for the signed-in student. */
export async function getMyOrgAccessStatus(): Promise<ApiResult<OrgAccessStatusResult>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'network') return fail('network');
  if (outcome === 'session_expired') return fail('session_expired');
  const session = getSession();
  if (!session) return fail('session_expired');
  if (session.role === 'adviser') return fail('forbidden');
  const studentId = session.studentId;
  const request = allRequests()
    .filter((entry) => entry.studentId === studentId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null;
  const approvedMembership: Membership | null = request?.status === 'approved'
    ? { id: `mem-${request.id}`, organizationId: request.organizationId, studentId, position: request.position, status: 'active', appointedAt: request.decidedAt ?? request.requestedAt, endorsedByAdviserId: request.decidedByAdviserId ?? MOCK_ADVISERS[0].id }
    : null;
  const membership = data.memberships.find((entry) => entry.studentId === studentId) ?? approvedMembership;
  const organizationId = membership?.organizationId ?? request?.organizationId;
  const organization = MOCK_ORGANIZATIONS.find((entry) => entry.id === organizationId) ?? null;
  const adviser = organization ? MOCK_ADVISERS.find((entry) => entry.id === organization.adviserId) ?? null : null;
  const status = membership?.status === 'removed'
    ? 'removed'
    : membership?.status === 'active' || request?.status === 'approved'
      ? 'approved'
      : request?.status ?? 'none';
  return ok({ status, request, organization: organization ? { ...organization } : null, membership: membership ? { ...membership } : null, adviser: adviser ? { ...adviser } : null });
}

/** MOCK: withdraws the signed-in student's pending request. */
export async function withdrawMyOrgRequest(): Promise<ApiResult<void>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'network') return fail('network');
  if (outcome === 'session_expired') return fail('session_expired');
  const session = getSession();
  if (!session) return fail('session_expired');
  if (session.role === 'adviser') return fail('forbidden');
  const request = allRequests()
    .filter((entry) => entry.studentId === session.studentId && entry.status === 'pending')
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  if (!request) return fail('not_found');
  const withdrawn = readWithdrawnIds();
  withdrawn.add(request.id);
  writeWithdrawnIds(withdrawn);
  return ok(undefined);
}

// ---- Org data --------------------------------------------------------------------

/** Waits, checks the session, and allows only org members and advisers, like a server would. */
function withOrgSession<T>(run: (session: Session, outcome: ReturnType<typeof currentOutcome>) => ApiResult<T>): Promise<ApiResult<T>> {
  return withSession((outcome) => {
    const session = getSession();
    if (!session) return fail('session_expired');
    if (session.role === 'participant' || outcome === 'forbidden') return fail('forbidden');
    return run(session, outcome);
  });
}

// MOCK: builds the identity from the seeded officers and advisers.
export function getOrgIdentity(): Promise<ApiResult<OrgIdentity>> {
  return withOrgSession((session) => {
    const adviser = MOCK_ADVISERS[0];
    const organization = MOCK_ORGANIZATIONS.find((entry) => session.organizationIds.includes(entry.id));
    if (!organization) return fail('forbidden');

    if (session.role === 'adviser') {
      const person = MOCK_ADVISERS.find((entry) => entry.email.toLowerCase() === session.studentId.toLowerCase());
      if (!person) return fail('forbidden');
      return ok({
        role: 'adviser',
        accountId: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        position: 'Faculty adviser',
        organization: { ...organization },
        adviser: { ...person },
      });
    }

    const officer = MOCK_OFFICERS.find((entry) => entry.studentId === session.studentId);
    const approvedRequest = allRequests()
      .filter((entry) => entry.studentId === session.studentId && entry.status === 'approved' && entry.organizationId === organization.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
    const membership = data.memberships.find(
      (entry) => entry.studentId === session.studentId && entry.organizationId === organization.id && entry.status === 'active',
    ) ?? (approvedRequest ? {
      id: `mem-${approvedRequest.id}`,
      organizationId: approvedRequest.organizationId,
      studentId: approvedRequest.studentId,
      position: approvedRequest.position,
      status: 'active' as const,
      appointedAt: approvedRequest.decidedAt ?? approvedRequest.requestedAt,
      endorsedByAdviserId: approvedRequest.decidedByAdviserId ?? adviser.id,
    } : null);
    if ((!officer && !approvedRequest) || !membership) return fail('forbidden');
    const [firstName, ...lastParts] = (approvedRequest?.fullName ?? `${officer?.firstName ?? ''} ${officer?.lastName ?? ''}`).split(' ');
    return ok({
      role: 'org_member',
      accountId: session.studentId,
      firstName,
      lastName: lastParts.join(' '),
      studentId: session.studentId,
      email: `${session.studentId}@${STUDENT_EMAIL_DOMAIN}`,
      position: membership.position,
      organization: { ...organization },
      membership: { ...membership },
      adviser: { ...adviser },
    });
  });
}

// MOCK: published seminars and drafts of the officer's organizations, or none with ?mock=empty.
export function listOrgSeminars(): Promise<ApiResult<OrgSeminarListing>> {
  return withOrgSession((session, outcome) => {
    if (outcome === 'empty') return ok({ seminars: [], drafts: [] });
    const mine = (organizationId: string) => session.organizationIds.includes(organizationId);
    return ok({
      seminars: data.seminars.filter((seminar) => mine(seminar.organizationId)).map((seminar) => ({ ...seminar })),
      drafts: data.drafts.filter((draft) => mine(draft.organizationId)).map((draft) => ({ ...draft })),
    });
  });
}

// MOCK: every registration for the seminar, including removed ones, which carry their removal record.
export function listOrgRoster(seminarId: string): Promise<ApiResult<OrgRegistration[]>> {
  return withOrgSession((session) => {
    const seminar = data.seminars.find((entry) => entry.id === seminarId);
    if (!seminar || !session.organizationIds.includes(seminar.organizationId)) return fail('not_found');
    return ok(data.registrations.filter((entry) => entry.seminarId === seminarId).map((entry) => ({ ...entry })));
  });
}

// MOCK: the ledger the server holds. Entries still queued on a device are not in it.
export function listLedger(seminarId: string): Promise<ApiResult<ScanLedgerEntry[]>> {
  return withOrgSession((session) => {
    const seminar = data.seminars.find((entry) => entry.id === seminarId);
    if (!seminar || !session.organizationIds.includes(seminar.organizationId)) return fail('not_found');
    return ok(serverLedger.filter((entry) => entry.seminarId === seminarId).map((entry) => ({ ...entry })));
  });
}

// MOCK: appends the entries to the ledger as synced. An entry with an id the server already has is accepted
// without being added twice, so a retry after a dropped connection is safe. The mock does not check that the
// student is registered, which a real server must.
export function syncScans(entries: ScanLedgerEntry[]): Promise<ApiResult<SyncScansResult>> {
  return withOrgSession(() => {
    for (const entry of entries) {
      if (!serverLedger.some((existing) => existing.id === entry.id)) {
        serverLedger.push({ ...entry, synced: true });
      }
    }
    return ok({ accepted: entries.map((entry) => entry.id) });
  });
}
