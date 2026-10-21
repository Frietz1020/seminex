// Data contract used by the mock client. It is NOT confirmed against a backend.

export type ApiErrorCode =
  | 'invalid_credentials'
  | 'student_id_taken'
  | 'session_expired'
  | 'network'
  | 'not_found'
  | 'seminar_full'
  | 'not_available'
  | 'forbidden';

export interface ApiError {
  code: ApiErrorCode;
}

/** fromCache is true when the data came from the offline cache because the network failed. */
export type ApiResult<T> =
  | { ok: true; data: T; fromCache?: boolean }
  | { ok: false; error: ApiError };

export type Program = 'CS' | 'IT' | 'EMC';
export type YearLevel = 1 | 2 | 3 | 4;
export type Block = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface SignInInput {
  studentId: string;
  password: string;
}

export interface SignUpInput {
  studentId: string;
  password: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  program: Program;
  yearLevel: YearLevel;
  block: Block;
}

/**
 * What the signed-in account may open. An org member also has participant access, so every org member
 * can use the student portal. An adviser is faculty and has no student portal.
 */
export type SessionRole = 'participant' | 'org_member' | 'adviser';

/**
 * expiresAt is epoch milliseconds. studentId is the account identifier: the Student ID for students and
 * org members, and the faculty email for advisers. MOCK contract; a real server decides what it returns.
 */
export interface Session {
  studentId: string;
  token: string;
  expiresAt: number;
  role: SessionRole;
  /** Organizations the account is an active member of, or advises. Empty for participants. */
  organizationIds: string[];
}

export interface SignUpResult {
  email: string;
}

/** The fields a student may change. Everything else on Profile is read-only. */
export interface EditableProfile {
  firstName: string;
  lastName: string;
  middleInitial: string;
  program: Program;
  yearLevel: YearLevel;
  block: Block;
}

export type EnrollmentStatus = 'active' | 'inactive';

export interface Profile extends EditableProfile {
  studentId: string;
  /** Not confirmed against a backend: the college and enrollment status are assumed to come with the profile. */
  college: string;
  enrollmentStatus: EnrollmentStatus;
  /** Absent until a photo is uploaded; the app then shows initials. */
  avatarUrl?: string;
  unreadNotificationCount: number;
}

export interface AvatarResult {
  avatarUrl: string;
}

export interface Speaker {
  name: string;
  role: string;
  organization?: string;
  bio?: string;
  photoUrl?: string;
}

export interface Seminar {
  id: string;
  reference: string;
  title: string;
  /** Short text for cards. */
  description: string;
  overview?: string;
  objectives?: string[];
  venueGuidelines?: string;
  speaker: Speaker;
  venue: string;
  department: string;
  topics: string[];
  /** ISO 8601 timestamps. */
  startsAt: string;
  endsAt: string;
  capacity: number;
  registeredCount: number;
  imageUrl?: string;
  requiredAttendancePercent: number;
  curriculumCredit?: string;
  organizingBody?: string;
  certificateEligibility?: string;
}

export interface TimeIn {
  at: string;
  station?: string;
}

export interface TimeOut {
  at: string;
  validated: boolean;
}

export interface Registration {
  reference: string;
  registeredAt: string;
  timeIn: TimeIn | null;
  timeOut: TimeOut | null;
  evaluationSubmittedAt: string | null;
  certificateIssuedAt: string | null;
}

export interface SeminarListItem {
  seminar: Seminar;
  registration: Registration | null;
}

export interface Ticket {
  seminarId: string;
  token: string;
  issuedAt: string;
}

export interface EvaluationDue {
  seminarId: string;
  seminarTitle: string;
}
// ---- Evaluation survey ------------------------------------------------------------
// The Org Member sets the survey, so the form is built from this definition. The shape is NOT
// confirmed against a backend. Prompts, help text, placeholders, and descriptors may contain
// {speaker}, which the page replaces with the speaker's name.

export interface SurveyOption {
  value: string;
  label: string;
  description?: string;
  /** Name of an icon the app already has. Unknown names are ignored. */
  icon?: string;
}

interface SurveyQuestionBase {
  id: string;
  prompt: string;
  help?: string;
  required: boolean;
}

export type SurveyQuestion = SurveyQuestionBase &
  (
    | { type: 'scale'; min: number; max: number; startLabel: string; endLabel: string }
    | { type: 'rating'; max: number; descriptors: string[] }
    | { type: 'choice'; columns: 1 | 2; options: SurveyOption[] }
    | { type: 'paragraph'; maxLength: number; placeholder?: string }
  );

export interface SurveySection {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export interface Survey {
  id: string;
  /** Changes whenever the questions change, so saved drafts for an older survey can be dropped. */
  version: number;
  seminarId: string;
  sections: SurveySection[];
}

/** Answers by question id. Scale and rating answers are the number as text. */
export type EvaluationAnswers = Record<string, string>;

export interface SubmitEvaluationResult {
  /** Present only if the server issued a certificate serial at submission. */
  certificateSerial?: string;
}