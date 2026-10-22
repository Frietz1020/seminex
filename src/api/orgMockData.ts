/**
 * MOCK DATA for the org side. Generated relative to the time the app loads, so draft, upcoming,
 * ongoing, finished, and cancelled seminars exist at any time. Not real records.
 * One organization (CCS Student Council) has data. Names are invented.
 *
 * Certificate records are assigned here with a simple rule so every state exists. The eligibility rule
 * itself is built later as a pure function of the ledger, the attendance rule, and evaluation submission.
 */
import { STUDENT_EMAIL_DOMAIN } from '../config';
import type { Block, Program, SurveyOption, YearLevel } from './types';
import type {
  Adviser,
  AuthoredSurvey,
  CertificateRecord,
  CertificateTemplate,
  LedgerKind,
  Membership,
  Organization,
  OrgRegistration,
  OrgRequest,
  OrgSeminar,
  OverrideRequest,
  ScanLedgerEntry,
  SeminarDraft,
  SurveyResponse,
} from './orgTypes';

const MINUTE = 60_000;
const DAY = 24 * 60;

function iso(base: number, offsetMinutes: number): string {
  return new Date(base + offsetMinutes * MINUTE).toISOString();
}

export const CCS_COUNCIL_ID = 'ccs-council';
export const ADVISER_RIVERA_ID = 'adviser-rivera';

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: CCS_COUNCIL_ID,
    name: 'CCS Student Council',
    department: 'College of Computer Studies',
    adviserId: ADVISER_RIVERA_ID,
  },
];

export const MOCK_ADVISERS: Adviser[] = [
  {
    id: ADVISER_RIVERA_ID,
    email: `elena.rivera@${STUDENT_EMAIL_DOMAIN}`,
    firstName: 'Elena',
    lastName: 'Rivera',
    title: 'Faculty Adviser, College of Computer Studies',
    organizationIds: [CCS_COUNCIL_ID],
  },
];

/** Officers who can sign in to the org portal. The Student ID is the sign-in name. */
export interface OfficerSeed {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  position: string;
}

export const MOCK_OFFICERS: OfficerSeed[] = [
  { studentId: '202110482', firstName: 'Juan', lastName: 'Dela Cruz', middleInitial: 'B', position: 'Event Director' },
  { studentId: '202008491', firstName: 'Maria Clara', lastName: 'Santos', middleInitial: 'R', position: 'Secretary' },
  { studentId: '202110483', firstName: 'Rafael Luis', lastName: 'Roxas', middleInitial: 'D', position: 'President' },
];

export type SeedAccess =
  | { role: 'org_member'; organizationIds: string[] }
  | { role: 'adviser'; organizationIds: string[] };

/**
 * Role lookup for the session. Seeded accounts only: an approved request adds a membership later, and
 * that is stored where the mock keeps requests (see orgMock.ts).
 */
export function findSeedAccess(identifier: string): SeedAccess | null {
  const key = identifier.trim().toLowerCase();
  const adviser = MOCK_ADVISERS.find((entry) => entry.email.toLowerCase() === key);
  if (adviser) return { role: 'adviser', organizationIds: adviser.organizationIds };
  const officer = MOCK_OFFICERS.find((entry) => entry.studentId === key);
  if (officer) return { role: 'org_member', organizationIds: [CCS_COUNCIL_ID] };
  return null;
}

// ---- Students --------------------------------------------------------------------

const FIRST_NAMES = ['Aurelia', 'Marco', 'Katrina', 'Jerome', 'David', 'Elena', 'Paolo', 'Bianca', 'Gabriel', 'Nina'];
const LAST_NAMES = [
  'Cruz', 'Navarro', 'Ramos', 'Castillo', 'Lopez', 'Aquino', 'Mendoza', 'Villanueva', 'Reyes', 'Garcia', 'Bautista', 'Flores',
];
const PROGRAMS: Program[] = ['CS', 'IT', 'EMC'];
const BLOCKS: Block[] = ['A', 'B', 'C', 'D'];
const YEARS: YearLevel[] = [2, 3, 4, 1];
const STUDENT_POOL_SIZE = 40;

interface StudentSeed {
  studentId: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  program: Program;
  yearLevel: YearLevel;
  block: Block;
}

function buildStudents(): StudentSeed[] {
  return Array.from({ length: STUDENT_POOL_SIZE }, (_, i) => ({
    studentId: `2023${String(10000 + i).padStart(5, '0')}`,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length],
    middleInitial: String.fromCharCode(65 + ((i * 5) % 26)),
    program: PROGRAMS[i % PROGRAMS.length],
    yearLevel: YEARS[i % YEARS.length],
    block: BLOCKS[(i * 3) % BLOCKS.length],
  }));
}

// ---- Default survey and certificate template -------------------------------------

const TOPIC_OPTIONS: SurveyOption[] = [
  { value: 'topic_1', label: 'Core concepts' },
  { value: 'topic_2', label: 'Live demonstration' },
  { value: 'topic_3', label: 'Case studies' },
  { value: 'topic_4', label: 'Question and answer' },
];

/** The default CCS evaluation. The builder's "Restore default CCS template" will use this shape. */
export function buildDefaultSurvey(seminarId: string): AuthoredSurvey {
  return {
    id: `survey-${seminarId}`,
    version: 1,
    seminarId,
    title: 'Seminar evaluation',
    instructions: 'Answer every required question. Your answers are anonymous to the organizers.',
    sections: [
      {
        id: 'content',
        title: 'Content and speaker',
        questions: [
          {
            id: 'relevance',
            type: 'scale',
            required: true,
            prompt: 'How relevant was the seminar to your studies?',
            min: 1,
            max: 5,
            startLabel: '1 - Not relevant',
            endLabel: '5 - Very relevant',
          },
          {
            id: 'speaker_rating',
            type: 'rating',
            required: true,
            prompt: 'How would you rate the speaker?',
            max: 5,
            descriptors: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
          },
          {
            id: 'topics_valued',
            type: 'checkbox',
            required: false,
            columns: 2,
            prompt: 'Which parts did you find useful?',
            options: TOPIC_OPTIONS,
          },
        ],
      },
      {
        id: 'logistics',
        title: 'Venue and feedback',
        questions: [
          {
            id: 'venue_quality',
            type: 'choice',
            required: true,
            columns: 1,
            prompt: 'How was the venue?',
            options: [
              { value: 'good', label: 'Good' },
              { value: 'fair', label: 'Fair' },
              { value: 'poor', label: 'Needs improvement' },
            ],
          },
          {
            id: 'open_feedback',
            type: 'paragraph',
            required: false,
            maxLength: 600,
            prompt: 'What should we change or add next time?',
            placeholder: 'Write your suggestions',
          },
        ],
      },
    ],
  };
}

/** A plain bordered certificate background as an SVG data URL, so no file or network is needed. */
function buildTemplateBackground(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">' +
    '<rect width="1920" height="1080" fill="#FFFDF9"/>' +
    '<rect x="48" y="48" width="1824" height="984" fill="none" stroke="#7A1C1C" stroke-width="10"/>' +
    '<rect x="76" y="76" width="1768" height="928" fill="none" stroke="#8C827C" stroke-width="3"/>' +
    '<text x="960" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="96" fill="#5B0309">Certificate of Participation</text>' +
    '<text x="960" y="400" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#4D4440">This certificate is presented to</text>' +
    '<text x="960" y="760" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#4D4440">for attending the seminar</text>' +
    '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildDefaultCertificateTemplate(base = Date.now()): CertificateTemplate {
  return {
    backgroundUrl: buildTemplateBackground(),
    updatedAt: iso(base, -2 * DAY),
    nameBox: {
      x: 360,
      y: 480,
      width: 1200,
      height: 140,
      fontFamily: 'Outfit',
      fontSize: 72,
      fontWeight: 700,
      align: 'center',
      color: '#1B365D',
    },
  };
}

// ---- Seminars --------------------------------------------------------------------

interface SeminarSeed {
  id: string;
  title: string;
  description: string;
  speakerName: string;
  speakerRole: string;
  venue: string;
  department: string;
  topics: string[];
  /** Minutes from now. */
  startOffsetMin: number;
  durationMin: number;
  capacity: number;
  registrations: number;
  registrationClosed?: boolean;
  endedEarlyAfterMin?: number;
  cancelled?: { atOffsetMin: number; reason: string };
}

const IT = 'Information Technology';
const CS = 'Computer Science';

const SEMINAR_SEEDS: SeminarSeed[] = [
  {
    id: 'org-sem-ongoing',
    title: 'Next-Gen Web Architecture with Microfrontends',
    description: 'How teams split a large web app into parts that ship on their own, and what it costs.',
    speakerName: 'Engr. Alyssa Valdez',
    speakerRole: 'Lead Solutions Architect',
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['web architecture'],
    startOffsetMin: -45,
    durationMin: 210,
    capacity: 40,
    registrations: 36,
  },
  {
    id: 'org-sem-soon',
    title: 'Introduction to Secure Coding',
    description: 'Common web vulnerabilities and the habits that prevent them.',
    speakerName: 'Dr. Aris Thorne',
    speakerRole: 'Visiting Research Fellow',
    venue: 'CCS Computer Lab 404',
    department: CS,
    topics: ['security'],
    startOffsetMin: 90,
    durationMin: 180,
    capacity: 60,
    registrations: 22,
  },
  {
    id: 'org-sem-upcoming-1',
    title: 'Distributed Cloud Systems Masterclass',
    description: 'Designing services that keep working when part of the system fails.',
    speakerName: 'Engr. Marcus Vance',
    speakerRole: 'Senior Cloud Engineer',
    venue: 'Main Auditorium, Building A',
    department: IT,
    topics: ['cloud'],
    startOffsetMin: 3 * DAY,
    durationMin: 180,
    capacity: 50,
    registrations: 31,
  },
  {
    id: 'org-sem-upcoming-2',
    title: 'Applied Data Engineering in Research',
    description: 'Cleaning, storing, and sharing research data so others can reuse it.',
    speakerName: 'Dr. Julian Mercer',
    speakerRole: 'Data Engineering Lead',
    venue: 'Engineering Innovation Lab 4',
    department: CS,
    topics: ['data'],
    startOffsetMin: 6 * DAY,
    durationMin: 180,
    capacity: 30,
    registrations: 30,
    registrationClosed: true,
  },
  {
    id: 'org-sem-recent',
    title: 'Cyber Threat Intelligence and Incident Response',
    description: 'Reading threat reports and running the first hour of an incident.',
    speakerName: 'Dr. Aris Thorne',
    speakerRole: 'Visiting Research Fellow',
    venue: 'CCS Main Amphitheater',
    department: IT,
    topics: ['security'],
    startOffsetMin: -(180 + 20),
    durationMin: 180,
    capacity: 40,
    registrations: 28,
  },
  {
    id: 'org-sem-finished-1',
    title: 'Principles of Real-Time Systems',
    description: 'Timing, scheduling, and testing for systems that must respond on time.',
    speakerName: 'Engr. Marcus Vance',
    speakerRole: 'Senior Cloud Engineer',
    venue: 'Auditorium B',
    department: CS,
    topics: ['systems'],
    startOffsetMin: -9 * DAY,
    durationMin: 180,
    capacity: 40,
    registrations: 34,
  },
  {
    id: 'org-sem-finished-early',
    title: 'Game Design Workshop',
    description: 'Prototype a small game idea in one session.',
    speakerName: 'Prof. Nina Lacson',
    speakerRole: 'Game Designer',
    venue: 'CCS Multimedia Room 302',
    department: 'Entertainment and Multimedia Computing',
    topics: ['game design'],
    startOffsetMin: -25 * DAY,
    durationMin: 240,
    capacity: 30,
    registrations: 26,
    endedEarlyAfterMin: 150,
  },
  {
    id: 'org-sem-finished-old',
    title: 'Version Control for Student Teams',
    description: 'Branching, reviews, and fixing mistakes without losing work.',
    speakerName: 'Engr. Alyssa Valdez',
    speakerRole: 'Lead Solutions Architect',
    venue: 'CCS Computer Lab 404',
    department: IT,
    topics: ['tools'],
    startOffsetMin: -40 * DAY,
    durationMin: 150,
    capacity: 36,
    registrations: 30,
  },
  {
    id: 'org-sem-cancelled-upcoming',
    title: 'Quantum Computing Basics',
    description: 'A first look at qubits and what they can and cannot do.',
    speakerName: 'Dr. Julian Mercer',
    speakerRole: 'Data Engineering Lead',
    venue: 'Main Auditorium, Building A',
    department: CS,
    topics: ['quantum'],
    startOffsetMin: 10 * DAY,
    durationMin: 120,
    capacity: 60,
    registrations: 12,
    cancelled: { atOffsetMin: -2 * DAY, reason: 'The speaker is no longer available on this date.' },
  },
  {
    id: 'org-sem-cancelled-past',
    title: 'Mobile App Showcase',
    description: 'Student teams present their mobile apps.',
    speakerName: 'Prof. Nina Lacson',
    speakerRole: 'Game Designer',
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['mobile'],
    startOffsetMin: -15 * DAY,
    durationMin: 120,
    capacity: 50,
    registrations: 18,
    cancelled: { atOffsetMin: -20 * DAY, reason: 'The venue was booked for a college event on the same day.' },
  },
];

interface OrgMockData {
  organizations: Organization[];
  advisers: Adviser[];
  memberships: Membership[];
  seminars: OrgSeminar[];
  drafts: SeminarDraft[];
  registrations: OrgRegistration[];
  ledger: ScanLedgerEntry[];
  surveys: AuthoredSurvey[];
  responses: SurveyResponse[];
  certificates: CertificateRecord[];
  certificateTemplates: Record<string, CertificateTemplate>;
  overrides: OverrideRequest[];
  requests: OrgRequest[];
}

const COMMENTS = [
  'The live demonstration made the topic clear.',
  'More time for questions would help.',
  'Please share the slides after the seminar.',
  'The room was too warm during the second half.',
  'Good pace. I would attend a follow-up session.',
  'The examples matched what we study in class.',
];

export function buildOrgMockData(base: number): OrgMockData {
  const students = buildStudents();
  const officer = MOCK_OFFICERS[1];
  const officerName = `${officer.firstName} ${officer.lastName}`;
  const year = new Date(base).getFullYear();

  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const seminars: OrgSeminar[] = [];
  const registrations: OrgRegistration[] = [];
  const ledger: ScanLedgerEntry[] = [];
  const responses: SurveyResponse[] = [];
  const surveys: AuthoredSurvey[] = [];
  const certificates: CertificateRecord[] = [];
  const template = buildDefaultCertificateTemplate(base);
  const certificateTemplates: Record<string, CertificateTemplate> = {};

  const ledgerEntry = (
    seminarId: string,
    studentId: string,
    kind: LedgerKind,
    offsetMin: number,
    extra: Partial<ScanLedgerEntry> = {},
  ): void => {
    const at = iso(base, offsetMin);
    ledger.push({
      id: `led-${seminarId}-${ledger.length}`,
      seminarId,
      studentId,
      kind,
      at,
      method: 'qr',
      officerId: officer.studentId,
      officerName,
      clientTimestamp: at,
      synced: true,
      ...extra,
    });
  };

  SEMINAR_SEEDS.forEach((entry, seminarIndex) => {
    const startsOffset = entry.startOffsetMin;
    const endsOffset = startsOffset + entry.durationMin;
    const endedEarly = entry.endedEarlyAfterMin !== undefined;
    const effectiveEndOffset = endedEarly ? startsOffset + (entry.endedEarlyAfterMin ?? 0) : endsOffset;
    const cancelled = entry.cancelled !== undefined;
    const started = startsOffset <= 0 && !cancelled;
    const finished = effectiveEndOffset <= 0 && !cancelled;

    const roster = Array.from({ length: entry.registrations }, (_, i) => students[(i + seminarIndex * 3) % students.length]);
    roster.forEach((student, i) => {
      registrations.push({
        id: `reg-${entry.id}-${student.studentId}`,
        seminarId: entry.id,
        ...student,
        email: `${student.studentId}@${STUDENT_EMAIL_DOMAIN}`,
        registeredAt: iso(base, startsOffset - (2 + (i % 6)) * DAY + i * 17),
        removal: null,
      });
    });

    // One removed registration on the ongoing seminar, to show the removal record.
    if (entry.id === 'org-sem-ongoing') {
      const removed = students[(entry.registrations + 5) % students.length];
      registrations.push({
        id: `reg-${entry.id}-${removed.studentId}`,
        seminarId: entry.id,
        ...removed,
        email: `${removed.studentId}@${STUDENT_EMAIL_DOMAIN}`,
        registeredAt: iso(base, startsOffset - 3 * DAY),
        removal: {
          reason: 'Duplicate registration',
          note: 'The student registered twice. The earlier entry was kept.',
          at: iso(base, startsOffset - 1 * DAY),
          officerId: officer.studentId,
          officerName,
        },
      });
    }

    const seminar: OrgSeminar = {
      id: entry.id,
      reference: `SEM-${year}-${String(200 + seminarIndex).padStart(4, '0')}`,
      title: entry.title,
      description: entry.description,
      speaker: { name: entry.speakerName, role: entry.speakerRole },
      venue: entry.venue,
      department: entry.department,
      topics: entry.topics,
      startsAt: iso(base, startsOffset),
      endsAt: iso(base, endsOffset),
      capacity: entry.capacity,
      registeredCount: entry.registrations,
      requiredAttendancePercent: 60,
      organizationId: CCS_COUNCIL_ID,
      registrationClosed: entry.registrationClosed === true,
      endedEarlyAt: endedEarly ? iso(base, effectiveEndOffset) : null,
      cancellation: entry.cancelled
        ? {
            reason: entry.cancelled.reason,
            at: iso(base, entry.cancelled.atOffsetMin),
            officerId: officer.studentId,
            officerName,
          }
        : null,
    };
    seminars.push(seminar);
    certificateTemplates[seminar.id] = template;

    if (cancelled || startsOffset > 0) return;

    // Ledger and certificates for seminars that have started.
    const survey = buildDefaultSurvey(entry.id);
    surveys.push(survey);
    const requiredMinutes = Math.ceil(((effectiveEndOffset - startsOffset) * seminar.requiredAttendancePercent) / 100);
    const attended = new Map<string, { minutes: number; timedOut: boolean; timedIn: boolean }>();

    roster.forEach((student, i) => {
      const pattern = i % 9;
      if (pattern === 0 && finished) {
        attended.set(student.studentId, { minutes: 0, timedOut: false, timedIn: false });
        return; // absent
      }
      if (!started) return;
      const inAt = startsOffset + 4 + ((i * 3) % 22);
      if (!finished && i % 10 >= 7) return; // not yet arrived
      const manual = i % 17 === 0;
      ledgerEntry(entry.id, student.studentId, 'time_in', inAt, manual ? { method: 'manual', reason: 'Phone battery was empty.' } : {});
      if (!finished) return;
      if (pattern === 1) {
        attended.set(student.studentId, { minutes: effectiveEndOffset - inAt, timedOut: false, timedIn: true });
        return; // missing time-out
      }
      const outAt = pattern === 2 ? inAt + 35 : effectiveEndOffset - 2 - (i % 6);
      ledgerEntry(entry.id, student.studentId, 'time_out', outAt);
      attended.set(student.studentId, { minutes: outAt - inAt, timedOut: true, timedIn: true });
    });

    // One correction on the first finished seminar: a missing time-out recorded afterwards.
    if (entry.id === 'org-sem-finished-1') {
      const target = roster.find((_, i) => i % 9 === 1);
      if (target) {
        ledgerEntry(entry.id, target.studentId, 'correction', effectiveEndOffset - 3, {
          method: 'manual',
          target: 'time_out',
          reason: 'The student left with the speaker group and the exit scan was missed.',
          correctsEntryId: ledger.find((l) => l.studentId === target.studentId && l.kind === 'time_in')?.id,
        });
        const current = attended.get(target.studentId);
        if (current) attended.set(target.studentId, { ...current, timedOut: true, minutes: current.minutes - 3 });
      }
    }

    if (!finished) return;

    let serial = 100 * (seminarIndex + 1);
    roster.forEach((student, i) => {
      const record = attended.get(student.studentId);
      const id = `cert-${entry.id}-${student.studentId}`;
      if (!record || !record.timedIn) {
        certificates.push({ id, seminarId: entry.id, studentId: student.studentId, state: 'blocked', reason: 'No time-in was recorded.' });
        return;
      }
      if (!record.timedOut) {
        certificates.push({ id, seminarId: entry.id, studentId: student.studentId, state: 'blocked', reason: 'No time-out was recorded.' });
        return;
      }
      if (record.minutes < requiredMinutes) {
        const percent = Math.round((record.minutes / (effectiveEndOffset - startsOffset)) * 100);
        certificates.push({
          id,
          seminarId: entry.id,
          studentId: student.studentId,
          state: 'blocked',
          reason: `Attended ${percent}% of the seminar. At least ${seminar.requiredAttendancePercent}% is needed.`,
        });
        return;
      }
      const evaluated = i % 3 !== 0;
      if (!evaluated) {
        certificates.push({
          id,
          seminarId: entry.id,
          studentId: student.studentId,
          state: 'waiting',
          reason: 'Waiting for the student to submit the evaluation.',
        });
        return;
      }
      serial += 1;
      certificates.push({
        id,
        seminarId: entry.id,
        studentId: student.studentId,
        state: 'issued',
        reason: 'Attendance and evaluation requirements are met.',
        issuedAt: iso(base, effectiveEndOffset + 10),
        serial: `SNX-${year}-${serial}`,
      });

      responses.push({
        id: `resp-${entry.id}-${student.studentId}`,
        seminarId: entry.id,
        surveyId: survey.id,
        surveyVersion: survey.version,
        respondentLabel: `Attendee #${String(responses.length + 1).padStart(2, '0')}`,
        submittedAt: iso(base, effectiveEndOffset + 5 + (i % 40)),
        answers: {
          relevance: String(3 + Math.floor(random() * 3)),
          speaker_rating: String(3 + Math.floor(random() * 3)),
          topics_valued: JSON.stringify(TOPIC_OPTIONS.filter(() => random() > 0.5).map((option) => option.value)),
          venue_quality: ['good', 'good', 'fair', 'poor'][Math.floor(random() * 4)],
          open_feedback: i % 2 === 0 ? COMMENTS[i % COMMENTS.length] : '',
        },
      });
    });
  });

  // ---- Drafts ----
  const draftDetails = {
    ready: {
      title: 'AI in Systems Engineering Workshop',
      description: 'A hands-on session on using machine learning tools in systems design work.',
      speakerName: 'Dr. Aris Thorne',
      speakerRole: 'Visiting Research Fellow',
      venue: 'CCS Computer Lab 404',
      department: CS,
      startsAt: iso(base, 14 * DAY),
      endsAt: iso(base, 14 * DAY + 180),
      capacity: 45,
      requiredAttendancePercent: 60,
    },
  };
  const drafts: SeminarDraft[] = [
    {
      id: 'draft-ready',
      organizationId: CCS_COUNCIL_ID,
      createdByOfficerId: MOCK_OFFICERS[0].studentId,
      createdAt: iso(base, -3 * DAY),
      updatedAt: iso(base, -1 * DAY),
      details: draftDetails.ready,
      certificate: template,
      survey: buildDefaultSurvey('draft-ready'),
    },
    {
      id: 'draft-no-certificate',
      organizationId: CCS_COUNCIL_ID,
      createdByOfficerId: MOCK_OFFICERS[1].studentId,
      createdAt: iso(base, -5 * DAY),
      updatedAt: iso(base, -2 * DAY),
      details: {
        ...draftDetails.ready,
        title: 'Cloud Security Essentials Workshop',
        startsAt: iso(base, 21 * DAY),
        endsAt: iso(base, 21 * DAY + 150),
        capacity: 80,
      },
      certificate: null,
      survey: buildDefaultSurvey('draft-no-certificate'),
    },
    {
      id: 'draft-incomplete',
      organizationId: CCS_COUNCIL_ID,
      createdByOfficerId: MOCK_OFFICERS[0].studentId,
      createdAt: iso(base, -1 * DAY),
      updatedAt: iso(base, -1 * DAY),
      details: { title: 'Ethical Hacking: Intro to Offensive Ops', startsAt: iso(base, 28 * DAY), capacity: 60 },
      certificate: null,
      survey: null,
    },
  ];

  // ---- Members, requests, overrides ----
  const memberships: Membership[] = MOCK_OFFICERS.map((entry, i) => ({
    id: `mem-${entry.studentId}`,
    organizationId: CCS_COUNCIL_ID,
    studentId: entry.studentId,
    position: entry.position,
    status: 'active',
    appointedAt: iso(base, -(120 + i * 10) * DAY),
    endorsedByAdviserId: ADVISER_RIVERA_ID,
  }));

  const requests: OrgRequest[] = [
    {
      id: 'req-seed-1',
      studentId: '202111003',
      fullName: 'Katrina Ramos',
      organizationId: CCS_COUNCIL_ID,
      position: 'Public Relations Officer',
      requestedAt: iso(base, -2 * DAY),
      status: 'pending',
    },
  ];

  const blocked = certificates.find((c) => c.seminarId === 'org-sem-finished-1' && c.state === 'blocked' && c.reason.startsWith('Attended'));
  const overrides: OverrideRequest[] = blocked
    ? [
        {
          id: 'ovr-seed-1',
          seminarId: blocked.seminarId,
          studentId: blocked.studentId,
          requestedByOfficerId: MOCK_OFFICERS[0].studentId,
          requestedByName: `${MOCK_OFFICERS[0].firstName} ${MOCK_OFFICERS[0].lastName}`,
          directiveReference: 'CCS-DIR-2026-449',
          reason: 'The student left early to join an inter-college programming contest.',
          requestedAt: iso(base, -6 * DAY),
          status: 'pending',
        },
      ]
    : [];

  return {
    organizations: MOCK_ORGANIZATIONS,
    advisers: MOCK_ADVISERS,
    memberships,
    seminars,
    drafts,
    registrations,
    ledger,
    surveys,
    responses,
    certificates,
    certificateTemplates,
    overrides,
    requests,
  };
}
