/**
 * MOCK API. Nothing here contacts a server and none of this behavior is confirmed
 * for the real backend. Replace this module (see client.ts) when the API exists.
 *
 * Outcome selection (development only): open any page with ?mock=<outcome>, where
 * outcome is one of: success, invalid_credentials, student_id_taken, session_expired,
 * network, seminar_full, empty. The choice is kept until the page is reloaded without
 * the parameter. Vite replaces import.meta.env.DEV with false in production builds, so
 * that branch is dead code there and production always resolves to "success".
 *
 * Session: the mock stands in for the server by writing the session itself. In production
 * the server sets an httpOnly cookie and the browser never stores a session token.
 */
import { STUDENT_EMAIL_DOMAIN } from '../config';
import { getSession, saveSession } from '../session/storage';
import { buildRegistrations, buildSeminars } from './mockData';
import { findSeedAccess } from './orgMockData';
import type {
  ApiErrorCode,
  ApiResult,
  AvatarResult,
  EditableProfile,
  EvaluationAnswers,
  EvaluationDue,
  Profile,
  Registration,
  Seminar,
  SeminarListItem,
  Session,
  SignInInput,
  SignUpInput,
  SignUpResult,
  SubmitEvaluationResult,
  Survey,
  Ticket,
} from './types';

export type MockOutcome = 'success' | ApiErrorCode | 'empty';

const OUTCOMES: readonly MockOutcome[] = [
  'success',
  'forbidden',
  'invalid_credentials',
  'student_id_taken',
  'session_expired',
  'network',
  'seminar_full',
  'empty',
];

const LATENCY_MS = 800;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
let selected: MockOutcome = 'success';

export function currentOutcome(): MockOutcome {
  if (import.meta.env.DEV) {
    const param = new URLSearchParams(window.location.search).get('mock');
    const match = OUTCOMES.find((outcome) => outcome === param);
    if (match) selected = match;
  }
  return selected;
}

export function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

export function fail<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function randomToken(bytes = 24): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return btoa(String.fromCharCode(...values)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// MOCK: the role comes from the seeded org accounts. A real server returns the role with the session.
export function startSession(studentId: string, accessOverride?: ReturnType<typeof findSeedAccess> | null): Session {
  const access = accessOverride === undefined ? findSeedAccess(studentId) : accessOverride;
  const session: Session = {
    studentId,
    token: randomToken(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    role: access?.role ?? 'participant',
    organizationIds: access?.organizationIds ?? [],
  };
  saveSession(session);
  return session;
}

// ---- Mock stores ---------------------------------------------------------------

const BASE = Date.now();
const seminars: Seminar[] = buildSeminars(BASE);
const registrations = new Map<string, Registration>(Object.entries(buildRegistrations(BASE)));
const ticketTokens = new Map<string, string>();

const MOCK_PROFILE_KEY = (studentId: string) => `seminex.mock.profile.${studentId}`;
type StoredProfile = EditableProfile;

// MOCK: the college and enrollment status are fixed placeholders. A real server returns them.
const MOCK_COLLEGE = 'College of Computer Studies';

// MOCK: avatars live in memory for this tab only (object URLs). A real server stores the photo and returns a URL.
const avatars = new Map<string, string>();

// MOCK: a placeholder identity, used when the student signed in without signing up in this browser.
const DEFAULT_PROFILE: StoredProfile = {
  firstName: 'Sample',
  lastName: 'Student',
  middleInitial: '',
  program: 'IT',
  yearLevel: 3,
  block: 'A',
};

function readStoredProfile(studentId: string): StoredProfile {
  try {
    const raw = window.localStorage.getItem(MOCK_PROFILE_KEY(studentId));
    if (raw) return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<StoredProfile>) };
  } catch {
    // Fall through to the default profile.
  }
  return DEFAULT_PROFILE;
}

function toItem(seminar: Seminar): SeminarListItem {
  const registration = registrations.get(seminar.id);
  return { seminar: { ...seminar }, registration: registration ? { ...registration } : null };
}

/** Waits, applies the shared outcomes, and checks the stored session like a server would. */
export async function withSession<T>(run: (outcome: MockOutcome) => ApiResult<T>): Promise<ApiResult<T>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'network' || outcome === 'session_expired') return fail(outcome);
  const session = getSession();
  if (!session || session.expiresAt <= Date.now()) return fail('session_expired');
  return run(outcome);
}

// ---- Auth ----------------------------------------------------------------------

// MOCK: fails with invalid_credentials, session_expired, or network when selected; otherwise
// succeeds and starts a session.
export async function signIn(input: SignInInput): Promise<ApiResult<Session>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'invalid_credentials' || outcome === 'session_expired' || outcome === 'network') {
    return fail(outcome);
  }
  return ok(startSession(input.studentId));
}

// MOCK: fails with student_id_taken or network when selected; otherwise succeeds.
// The email is derived from the Student ID by the mock, not returned by a real service.
// The entered name and program are kept in this browser only so the dashboard can show them.
export async function signUp(input: SignUpInput): Promise<ApiResult<SignUpResult>> {
  await wait();
  const outcome = currentOutcome();
  if (outcome === 'student_id_taken' || outcome === 'network') return fail(outcome);
  const stored: StoredProfile = {
    firstName: input.firstName,
    lastName: input.lastName,
    middleInitial: input.middleInitial,
    program: input.program,
    yearLevel: input.yearLevel,
    block: input.block,
  };
  try {
    window.localStorage.setItem(MOCK_PROFILE_KEY(input.studentId), JSON.stringify(stored));
  } catch {
    // Storage unavailable: the dashboard falls back to the default mock profile.
  }
  return ok({ email: `${input.studentId}@${STUDENT_EMAIL_DOMAIN}` });
}

// MOCK: fails with network when selected; otherwise succeeds.
export async function resendVerification(_email: string): Promise<ApiResult<void>> {
  await wait();
  if (currentOutcome() === 'network') return fail('network');
  return ok(undefined);
}

// ---- Dashboard -----------------------------------------------------------------

function buildProfile(studentId: string, outcome: MockOutcome): Profile {
  return {
    studentId,
    ...readStoredProfile(studentId),
    college: MOCK_COLLEGE,
    enrollmentStatus: 'active',
    avatarUrl: avatars.get(studentId),
    unreadNotificationCount: outcome === 'empty' ? 0 : 2,
  };
}

// MOCK: unread count is 2, or 0 with ?mock=empty.
export function getProfile(): Promise<ApiResult<Profile>> {
  return withSession((outcome) => {
    const session = getSession();
    if (!session) return fail('session_expired');
    return ok(buildProfile(session.studentId, outcome));
  });
}

// MOCK: stores the editable fields in this browser only. Fails with network or session_expired
// when selected. Whether the real server accepts every value is not confirmed.
export function updateProfile(input: EditableProfile): Promise<ApiResult<Profile>> {
  return withSession((outcome) => {
    const session = getSession();
    if (!session) return fail('session_expired');
    const stored: StoredProfile = {
      firstName: input.firstName,
      lastName: input.lastName,
      middleInitial: input.middleInitial,
      program: input.program,
      yearLevel: input.yearLevel,
      block: input.block,
    };
    try {
      window.localStorage.setItem(MOCK_PROFILE_KEY(session.studentId), JSON.stringify(stored));
    } catch {
      // Storage unavailable: the change lasts until the page is reloaded.
    }
    return ok({ ...buildProfile(session.studentId, outcome), ...stored });
  });
}

// MOCK: accepts any file the page passes in, keeps it in memory, and returns an object URL.
// Type and size limits are enforced by the page; the real server must enforce them too.
export function uploadAvatar(file: File): Promise<ApiResult<AvatarResult>> {
  return withSession(() => {
    const session = getSession();
    if (!session) return fail('session_expired');
    const previous = avatars.get(session.studentId);
    if (previous) URL.revokeObjectURL(previous);
    const avatarUrl = URL.createObjectURL(file);
    avatars.set(session.studentId, avatarUrl);
    return ok({ avatarUrl });
  });
}

// MOCK: nothing to revoke on a server. Drops the in-memory avatar. The client clears the
// session and offline data itself, whatever this returns.
export async function signOut(): Promise<ApiResult<void>> {
  await wait();
  const session = getSession();
  const avatar = session ? avatars.get(session.studentId) : undefined;
  if (session && avatar) {
    URL.revokeObjectURL(avatar);
    avatars.delete(session.studentId);
  }
  return ok(undefined);
}

// MOCK: finished seminars the student registered for, or none with ?mock=empty. Which seminars
// count as history is a rule a real server decides.
export function listHistory(): Promise<ApiResult<SeminarListItem[]>> {
  return withSession((outcome) => {
    if (outcome === 'empty') return ok([]);
    const now = Date.now();
    return ok(
      seminars
        .filter((seminar) => registrations.has(seminar.id) && Date.parse(seminar.endsAt) <= now)
        .map(toItem),
    );
  });
}

// MOCK: returns every seminar with the student's registration, or none with ?mock=empty.
export function listSeminars(): Promise<ApiResult<SeminarListItem[]>> {
  return withSession((outcome) => ok(outcome === 'empty' ? [] : seminars.map(toItem)));
}

export function getSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  return withSession(() => {
    const seminar = seminars.find((entry) => entry.id === seminarId);
    return seminar ? ok(toItem(seminar)) : fail('not_found');
  });
}

// MOCK: fails with seminar_full when selected, when capacity is reached, and with
// not_available once the seminar has finished.
export function registerForSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  return withSession((outcome) => {
    const seminar = seminars.find((entry) => entry.id === seminarId);
    if (!seminar) return fail('not_found');
    if (registrations.has(seminarId)) return ok(toItem(seminar));
    if (outcome === 'seminar_full' || seminar.registeredCount >= seminar.capacity) return fail('seminar_full');
    if (new Date(seminar.endsAt).getTime() <= Date.now()) return fail('not_available');

    registrations.set(seminarId, {
      reference: `SEM-${new Date().getFullYear()}-${String(1000 + registrations.size).padStart(4, '0')}`,
      registeredAt: new Date().toISOString(),
      timeIn: null,
      timeOut: null,
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    });
    seminar.registeredCount += 1;
    return ok(toItem(seminar));
  });
}

// MOCK: allowed until a Time-In is recorded; after that it fails with not_available.
export function cancelRegistration(seminarId: string): Promise<ApiResult<void>> {
  return withSession(() => {
    const seminar = seminars.find((entry) => entry.id === seminarId);
    const registration = registrations.get(seminarId);
    if (!seminar || !registration) return fail('not_found');
    if (registration.timeIn) return fail('not_available');
    registrations.delete(seminarId);
    ticketTokens.delete(seminarId);
    seminar.registeredCount = Math.max(0, seminar.registeredCount - 1);
    return ok(undefined);
  });
}

// MOCK: the token is opaque and random. Production tokens must be issued and validated by the
// server. They must never be built from the student ID, because that makes them guessable.
export function getTicket(seminarId: string): Promise<ApiResult<Ticket>> {
  return withSession(() => {
    const registration = registrations.get(seminarId);
    if (!registration) return fail('not_found');
    let token = ticketTokens.get(seminarId);
    if (!token) {
      token = randomToken(18);
      ticketTokens.set(seminarId, token);
    }
    return ok({ seminarId, token, issuedAt: registration.registeredAt });
  });
}

// MOCK: lists finished seminars with a validated Time-Out and no submitted evaluation.
// A real server decides this rule.
export function listEvaluationsDue(): Promise<ApiResult<EvaluationDue[]>> {
  return withSession((outcome) => {
    if (outcome === 'empty') return ok([]);
    const now = Date.now();
    const due: EvaluationDue[] = [];
    for (const seminar of seminars) {
      const registration = registrations.get(seminar.id);
      const finished = new Date(seminar.endsAt).getTime() <= now;
      if (registration && finished && registration.timeOut?.validated && !registration.evaluationSubmittedAt) {
        due.push({ seminarId: seminar.id, seminarTitle: seminar.title });
      }
    }
    return ok(due);
  });
}

// MOCK: there is no real implementation. Always reports "not available yet".
export async function getTicketPdf(_seminarId: string): Promise<ApiResult<Blob>> {
  await wait();
  return fail('not_available');
}
// MOCK: there is no certificate file yet. Always reports "not available yet" so the page shows a
// plain message and never pretends to download anything.
export async function getCertificate(_seminarId: string): Promise<ApiResult<Blob>> {
  await wait();
  return fail('not_available');
}

// MOCK: the same survey for every seminar, reproducing the Stitch export's six questions in three
// sections. The topic options are placeholders; a real survey is set by the Org Member per seminar.
function buildMockSurvey(seminarId: string): Survey {
  return {
    id: 'mock-evaluation',
    version: 1,
    seminarId,
    sections: [
      {
        id: 'content',
        title: 'Session content and relevance',
        questions: [
          {
            id: 'relevance',
            type: 'scale',
            required: true,
            prompt: 'How relevant was the seminar content to your academic curriculum and career goals?',
            help: 'Rate your alignment on a 1 (low) to 5 (high) scale.',
            min: 1,
            max: 5,
            startLabel: '1 - Not relevant',
            endLabel: '5 - Extremely relevant',
          },
          {
            id: 'speaker_rating',
            type: 'rating',
            required: true,
            prompt: 'Speaker mastery and presentation quality ({speaker})',
            help: 'Evaluate technical depth, delivery pace, and engagement.',
            max: 5,
            descriptors: [
              'Poor presentation',
              'Fair, needs clearer delivery',
              'Satisfactory technical depth',
              'Very good and engaging',
              'Exceptional delivery',
            ],
          },
          {
            id: 'valuable_topic',
            type: 'choice',
            required: true,
            columns: 2,
            prompt: 'Which topic discussed did you find most valuable?',
            options: [
              { value: 'topic_1', label: 'Threat hunting and IOCs', description: 'Methodologies and behavioral indicators of compromise analysis' },
              { value: 'topic_2', label: 'Incident playbooks and MITRE ATT&CK', description: 'Tactics, enterprise matrix mapping, and containment paths' },
              { value: 'topic_3', label: 'Live forensics analysis demo', description: 'Memory capture examination and log triage session' },
              { value: 'topic_4', label: 'SOC workflow overview', description: 'Security operations tier 1 to 3 alert life cycle governance' },
            ],
          },
        ],
      },
      {
        id: 'logistics',
        title: 'Venue, organization, and student council logistics',
        questions: [
          {
            id: 'venue_quality',
            type: 'choice',
            required: true,
            columns: 2,
            prompt: 'How would you rate the venue facilities and audio-visual equipment?',
            options: [
              { value: 'excellent', label: 'Excellent', icon: 'thumb_up' },
              { value: 'satisfactory', label: 'Satisfactory', icon: 'check' },
              { value: 'needs_improvement', label: 'Needs improvement', icon: 'priority_high' },
            ],
          },
          {
            id: 'coordination',
            type: 'scale',
            required: true,
            prompt: 'Overall event coordination by the CCS Student Council marshals',
            help: 'Assessed on crowd control, attendance scanning efficiency, and question-and-answer moderation.',
            min: 1,
            max: 5,
            startLabel: '1 - Poor',
            endLabel: '5 - Outstanding',
          },
        ],
      },
      {
        id: 'feedback',
        title: 'Open feedback and recommendations',
        questions: [
          {
            id: 'open_feedback',
            type: 'paragraph',
            required: true,
            prompt: 'Key takeaways and suggestions for upcoming CCS technical seminars',
            maxLength: 600,
            placeholder: 'Write your thoughts, key learnings, or topic requests for the next workshop',
          },
        ],
      },
    ],
  };
}

// MOCK: only for seminars the student registered for.
export function getEvaluationSurvey(seminarId: string): Promise<ApiResult<Survey>> {
  return withSession(() => {
    if (!registrations.has(seminarId)) return fail('not_found');
    return ok(buildMockSurvey(seminarId));
  });
}

// MOCK: records the submission once, for a finished seminar with a validated Time-Out. It does not
// check the answers, which a real server must. It returns no certificate serial.
export function submitEvaluation(
  seminarId: string,
  _surveyId: string,
  _answers: EvaluationAnswers,
): Promise<ApiResult<SubmitEvaluationResult>> {
  return withSession(() => {
    const seminar = seminars.find((entry) => entry.id === seminarId);
    const registration = registrations.get(seminarId);
    if (!seminar || !registration) return fail('not_found');
    const finished = Date.parse(seminar.endsAt) <= Date.now();
    if (!finished || !registration.timeOut?.validated || registration.evaluationSubmittedAt) {
      return fail('not_available');
    }
    registration.evaluationSubmittedAt = new Date().toISOString();
    return ok({});
  });
}
