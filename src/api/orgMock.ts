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
  OrgAccess,
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
  return [...data.requests, ...readStoredRequests(), ...memoryRequests];
}

// ---- Auth ------------------------------------------------------------------------

function accessFor(identifier: string, session: Session): OrgAccess {
  if (session.role === 'adviser') return 'adviser';
  if (session.role === 'org_member') return 'organization';
  const latest = allRequests()
    .filter((request) => request.studentId === identifier)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
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
  const session = startSession(identifier);
  return ok({ access: accessFor(identifier, session) });
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
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  writeStoredRequests([...readStoredRequests(), request]);
  return ok(request);
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
    const membership = data.memberships.find(
      (entry) => entry.studentId === session.studentId && entry.organizationId === organization.id && entry.status === 'active',
    );
    if (!officer || !membership) return fail('forbidden');
    return ok({
      role: 'org_member',
      accountId: officer.studentId,
      firstName: officer.firstName,
      lastName: officer.lastName,
      studentId: officer.studentId,
      email: `${officer.studentId}@${STUDENT_EMAIL_DOMAIN}`,
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