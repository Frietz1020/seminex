// Org-side data contract used by the mock client. It is NOT confirmed against a backend.
// Student-side types stay in ./types and are reused here, not changed.

import type { Block, EvaluationAnswers, Program, Seminar, SurveyOption, SurveyQuestion, YearLevel } from './types';

// ---- Organizations, people, and access -------------------------------------------

export interface Organization {
  id: string;
  name: string;
  department: string;
  /** The adviser who endorses members and decides requests. */
  adviserId: string;
}

/** Faculty adviser (Admin). Signs in with a faculty email. Seeded by the developer. */
export interface Adviser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  organizationIds: string[];
}

export type MembershipStatus = 'active' | 'removed';

/** An officer's place in an organization. Present only after an adviser approves a request. */
export interface Membership {
  id: string;
  organizationId: string;
  studentId: string;
  position: string;
  status: MembershipStatus;
  appointedAt: string;
  endorsedByAdviserId: string;
  /** Present only if an appointment letter exists. The profile links to it only when set. */
  appointmentLetterUrl?: string;
}

export type OrgRequestStatus = 'pending' | 'approved' | 'rejected';

/** Created by organization sign-up. The account has no org access until an adviser approves it. */
export interface OrgRequest {
  id: string;
  studentId: string;
  fullName: string;
  organizationId: string;
  position: string;
  requestedAt: string;
  status: OrgRequestStatus;
  decidedAt?: string;
  decidedByAdviserId?: string;
  decisionNote?: string;
}

export interface OrgSignUpInput {
  organizationId: string;
  position: string;
}

export interface OrgSignInInput {
  /** A Student ID, or a faculty email for an adviser. */
  identifier: string;
  password: string;
}

/**
 * What an organization sign-in unlocked. "organization" and "adviser" open the org portal.
 * The other three signed the person in as a participant only.
 */
export type OrgAccess = 'organization' | 'adviser' | 'pending' | 'rejected' | 'none';

export interface OrgSignInResult {
  access: OrgAccess;
}

/** The signed-in org member or adviser, with the organization they act for. */
export interface OrgIdentity {
  role: 'org_member' | 'adviser';
  accountId: string;
  firstName: string;
  lastName: string;
  /** Student ID for an org member. Absent for an adviser. */
  studentId?: string;
  email: string;
  position: string;
  organization: Organization;
  /** Present for an org member: the appointment behind the access. */
  membership?: Membership;
  /** The adviser who endorsed the appointment, or the adviser themself. */
  adviser: Adviser;
  avatarUrl?: string;
}

// ---- Seminars --------------------------------------------------------------------

export interface CancellationRecord {
  reason: string;
  /** ISO 8601. */
  at: string;
  officerId: string;
  officerName: string;
}

/**
 * Fields the org side adds to a seminar. requiredAttendancePercent already lives on Seminar and is
 * the per-seminar value here. Lifecycle status is derived from the schedule plus these three flags.
 */
export interface OrgSeminarFields {
  organizationId: string;
  registrationClosed: boolean;
  /** Set by "End now". The seminar counts as ended from this time instead of endsAt. */
  endedEarlyAt: string | null;
  cancellation: CancellationRecord | null;
}

export type OrgSeminar = Seminar & OrgSeminarFields;

/** The details step of the create and edit wizard. Every field is optional while a draft is open. */
export interface SeminarDetailsDraft {
  title?: string;
  description?: string;
  speakerName?: string;
  speakerRole?: string;
  venue?: string;
  department?: string;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
  requiredAttendancePercent?: number;
  coverImageUrl?: string;
}

export interface SeminarDraft {
  id: string;
  organizationId: string;
  createdByOfficerId: string;
  createdAt: string;
  updatedAt: string;
  details: SeminarDetailsDraft;
  certificate: CertificateTemplate | null;
  survey: AuthoredSurvey | null;
}

export type ReadinessItemId = 'details' | 'certificate' | 'survey';

export interface ReadinessItem {
  id: ReadinessItemId;
  label: string;
  passed: boolean;
  /** Says what is missing. Empty when the item passed. */
  reason: string;
}

/** Computed from a draft by getDraftReadiness. Never stored. */
export interface DraftReadiness {
  items: ReadinessItem[];
  ready: boolean;
  /** The reason of the first failing item, shown on a draft card when Publish is disabled. */
  firstBlockingReason: string | null;
}

// ---- Registrations ---------------------------------------------------------------

export interface RegistrationRemoval {
  reason: string;
  note: string;
  at: string;
  officerId: string;
  officerName: string;
}

/** A student registered for an org seminar, as an officer sees them. */
export interface OrgRegistration {
  id: string;
  seminarId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  program: Program;
  yearLevel: YearLevel;
  block: Block;
  email: string;
  registeredAt: string;
  /** Set when an officer removed the student. The row is kept for the record. */
  removal: RegistrationRemoval | null;
}

// ---- Attendance ledger -----------------------------------------------------------

export type LedgerKind = 'time_in' | 'time_out' | 'correction';
export type ScanMethod = 'qr' | 'manual';

/**
 * One line of the attendance ledger. The ledger is append-only: an entry is never edited or deleted.
 * A correction is a new entry of kind "correction" that names the punch it replaces (target) and
 * the earlier entry it answers (correctsEntryId), with a justification and the acting officer.
 */
export interface ScanLedgerEntry {
  id: string;
  seminarId: string;
  studentId: string;
  kind: LedgerKind;
  /** The time the entry records, ISO 8601. For a correction, the corrected time. */
  at: string;
  method: ScanMethod;
  /** Required for a manual entry and for a correction. */
  reason?: string;
  /** Set only when kind is "correction". */
  target?: 'time_in' | 'time_out';
  correctsEntryId?: string;
  officerId: string;
  officerName: string;
  /** When the device recorded the entry, ISO 8601. Differs from the server time for an offline scan. */
  clientTimestamp: string;
  /** False while the entry waits in the device queue. */
  synced: boolean;
}

// ---- Certificates ----------------------------------------------------------------

export const CERTIFICATE_CANVAS_WIDTH = 1920;
export const CERTIFICATE_CANVAS_HEIGHT = 1080;

export type NameBoxAlign = 'left' | 'center' | 'right';

/** Position and size are pixels on a 1920 by 1080 canvas. */
export interface NameBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 700;
  align: NameBoxAlign;
  /** Six digit hex with a leading hash, for example #1B365D. */
  color: string;
}

export interface CertificateTemplate {
  /** Address of the background image. The mock uses a data URL. */
  backgroundUrl: string;
  nameBox: NameBox;
  updatedAt: string;
}

export type CertificateState = 'waiting' | 'blocked' | 'issued';

/** What the officer sees for one student. The state comes from the eligibility rule, with the reason. */
export interface CertificateRecord {
  id: string;
  seminarId: string;
  studentId: string;
  state: CertificateState;
  reason: string;
  issuedAt?: string;
  serial?: string;
}

export type OverrideStatus = 'pending' | 'approved' | 'rejected';

/** Officers cannot override eligibility. They ask, and an adviser decides. */
export interface OverrideRequest {
  id: string;
  seminarId: string;
  studentId: string;
  requestedByOfficerId: string;
  requestedByName: string;
  directiveReference: string;
  reason: string;
  requestedAt: string;
  status: OverrideStatus;
  decidedByAdviserId?: string;
  decidedAt?: string;
  decisionNote?: string;
}

// ---- Evaluation authoring and results --------------------------------------------

/**
 * Extends the student survey question types with checkbox choice. A checkbox answer is stored in the
 * existing string answer as a JSON array of option values. The student evaluation form cannot show this
 * type yet; the builder phase adds that.
 */
export interface CheckboxQuestion {
  id: string;
  type: 'checkbox';
  prompt: string;
  help?: string;
  required: boolean;
  columns: 1 | 2;
  options: SurveyOption[];
}

export type AuthoredQuestion = SurveyQuestion | CheckboxQuestion;

/** A section is a titled group of questions. Adding a section in the builder adds an item here. */
export interface AuthoredSection {
  id: string;
  title: string;
  questions: AuthoredQuestion[];
}

export interface AuthoredSurvey {
  id: string;
  /** Changes whenever the questions change, so saved student drafts for an older survey are dropped. */
  version: number;
  seminarId: string;
  title: string;
  instructions: string;
  sections: AuthoredSection[];
}

/** An officer sees responses without names. The label is stable within one seminar. */
export interface SurveyResponse {
  id: string;
  seminarId: string;
  surveyId: string;
  surveyVersion: number;
  respondentLabel: string;
  submittedAt: string;
  answers: EvaluationAnswers;
}

export interface OptionCount {
  value: string;
  label: string;
  count: number;
  /** 0 to 100, rounded. */
  percent: number;
}

export interface QuestionAggregate {
  questionId: string;
  prompt: string;
  type: AuthoredQuestion['type'];
  responseCount: number;
  /** Present for scale and rating questions. */
  mean?: number;
  /** Present for choice, checkbox, scale, and rating questions. */
  distribution?: OptionCount[];
  /** Present for paragraph questions. */
  comments?: string[];
}

export interface SurveyAggregate {
  seminarId: string;
  surveyId: string;
  surveyVersion: number;
  responseCount: number;
  /** Students who attended and were asked to respond. */
  eligibleCount: number;
  /** 0 to 100, rounded. */
  completionRate: number;
  questions: QuestionAggregate[];
}

// ---- Listings and sync -----------------------------------------------------------

/** Everything the org lists show: published seminars and unpublished drafts of the officer's organization. */
export interface OrgSeminarListing {
  seminars: OrgSeminar[];
  drafts: SeminarDraft[];
}

export interface SyncScansResult {
  /** Ids of the queued entries the server accepted. Entries it already had count as accepted. */
  accepted: string[];
}