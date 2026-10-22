/**
 * MOCK DATA. Generated relative to the time the app loads, so ongoing, upcoming,
 * finished, and full seminars exist at any time. Not real records.
 * No seminar has an image or speaker photo, so placeholders and initials render everywhere.
 */
import { REQUIRED_ATTENDANCE_PERCENT } from '../config';
import type { Registration, Seminar } from './types';

const MINUTE = 60_000;
const DAY_MIN = 24 * 60;

function iso(base: number, offsetMinutes: number): string {
  return new Date(base + offsetMinutes * MINUTE).toISOString();
}

const IT = 'Information Technology';
const CS = 'Computer Science';
const EMC = 'Entertainment and Multimedia Computing';

interface SeminarSeed {
  id: string;
  title: string;
  description: string;
  speaker: Seminar['speaker'];
  venue: string;
  department: string;
  topics: string[];
  startOffsetMin: number;
  durationMin: number;
  capacity: number;
  registeredCount: number;
  overview?: string;
  objectives?: string[];
  venueGuidelines?: string;
  curriculumCredit?: string;
  certificateEligibility?: string;
}

const SEEDS: SeminarSeed[] = [
  {
    id: 'microfrontends',
    title: 'Next-Gen Web Architecture with Microfrontends',
    description:
      'Design systems synchronization, isolated deployments, and real-time state orchestration across modular client architectures.',
    speaker: {
      name: 'Engr. Alyssa Valdez',
      role: 'Lead Solutions Architect',
      organization: 'Nexus Enterprise Labs',
      bio: 'Former senior UI engineer specializing in distributed frontend platforms.',
    },
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['web architecture', 'microfrontends'],
    startOffsetMin: -45,
    durationMin: 210,
    capacity: 120,
    registeredCount: 120,
    overview:
      'Monolithic frontend applications are hard to maintain when many teams work on them. This seminar covers microfrontend patterns, Module Federation, independent deployment, and team ownership.',
    objectives: [
      'Split an enterprise web platform using runtime integration.',
      'Build decoupled pipelines that share design tokens.',
      'Audit performance and bundle size across micro-apps.',
    ],
    venueGuidelines:
      'Observe the college dress code. Bring a laptop if you want to join the live Module Federation demonstrations.',
    curriculumCredit: '0.5 seminar unit',
    certificateEligibility: `Attendance of at least ${REQUIRED_ATTENDANCE_PERCENT}% of the session`,
  },
  {
    id: 'cyber-ir',
    title: 'Cyber Threat Intelligence & Incident Response',
    description: 'Threat modeling, detection basics, and a guided incident response walkthrough.',
    speaker: { name: 'Engr. Rafael David', role: 'InfoSec Consultant' },
    venue: 'CCS Computer Lab 4',
    department: IT,
    topics: ['security', 'incident response'],
    startOffsetMin: -390,
    durationMin: 210,
    capacity: 100,
    registeredCount: 92,
    overview: 'A practical introduction to threat intelligence and the incident response lifecycle.',
  },
  {
    id: 'responsible-ai',
    title: 'Responsible AI and Ethics in Software',
    description: 'Bias, transparency, and accountability when shipping machine learning features.',
    speaker: { name: 'Dr. Marcus Reyes', role: 'Senior AI Researcher' },
    venue: 'Gordon College Main Auditorium',
    department: CS,
    topics: ['ai', 'ethics'],
    startOffsetMin: -8 * DAY_MIN,
    durationMin: 180,
    capacity: 80,
    registeredCount: 70,
  },
  {
    id: 'agile-delivery',
    title: 'Agile Delivery for Student Teams',
    description: 'Planning, standups, and retrospectives that fit a semester project.',
    speaker: { name: 'Prof. Kimberly Santos', role: 'DevOps Engineer' },
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['agile', 'teamwork'],
    startOffsetMin: -15 * DAY_MIN,
    durationMin: 180,
    capacity: 90,
    registeredCount: 81,
  },
  {
    id: 'ux-research',
    title: 'UX Research for Interactive Media',
    description: 'Interviews, usability tests, and turning findings into design decisions.',
    speaker: { name: 'Paolo Mendoza', role: 'Game Designer' },
    venue: 'Audio-Visual Room 1',
    department: EMC,
    topics: ['ux', 'research'],
    startOffsetMin: -22 * DAY_MIN,
    durationMin: 180,
    capacity: 70,
    registeredCount: 64,
  },
  {
    id: 'data-pipelines',
    title: 'Data Pipeline Engineering with Apache Kafka',
    description: 'Streaming ingestion, topics and partitions, and keeping consumers reliable.',
    speaker: { name: 'Engr. Ronald Navarro', role: 'Data Engineer' },
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['data engineering', 'streaming'],
    startOffsetMin: -20 * DAY_MIN,
    durationMin: 240,
    capacity: 90,
    registeredCount: 77,
  },
  {
    id: 'ml-cv',
    title: 'Applied Machine Learning & Computer Vision in Industry',
    description:
      'Hands-on model training techniques, dataset curation, and real-time inference on edge devices. Participants will work through the machine-learning workflow from preparing and labeling a dataset to selecting a model, tuning its parameters, and evaluating its performance. The session also explores computer-vision applications such as image classification and object detection, with examples of how latency, memory, and power limits affect deployment on edge hardware. Attendees will review common sources of bias, compare ways to measure model quality, and see how a trained model can be optimized and integrated into a practical industry workflow.',
    speaker: { name: 'Dr. Marcus Reyes', role: 'Senior AI Researcher' },
    venue: 'Gordon College Gymnasium',
    department: CS,
    topics: ['machine learning', 'computer vision'],
    startOffsetMin: 2 * DAY_MIN,
    durationMin: 180,
    capacity: 80,
    registeredCount: 66,
  },
  {
    id: 'api-security',
    title: 'Enterprise API Security and OAuth 2.0 Implementation',
    description:
      'Learn real-world zero-trust patterns, token handling, and practical API fortification for cloud-connected student projects.',
    speaker: { name: 'Engr. Rafael David', role: 'InfoSec Consultant' },
    venue: 'CCS Multimedia Room 302',
    department: IT,
    topics: ['security', 'apis'],
    startOffsetMin: 4 * DAY_MIN,
    durationMin: 210,
    capacity: 100,
    registeredCount: 72,
  },
  {
    id: 'cloud-native',
    title: 'Cloud Native Deployment with Kubernetes & Docker',
    description:
      'Containerization fundamentals, multi-container orchestration, and automated CI/CD deployment pipelines.',
    speaker: { name: 'Prof. Kimberly Santos', role: 'DevOps Engineer' },
    venue: 'CCS Computer Lab 4',
    department: IT,
    topics: ['cloud', 'devops'],
    startOffsetMin: 5 * DAY_MIN,
    durationMin: 210,
    capacity: 120,
    registeredCount: 120,
  },
  {
    id: 'godot-pipeline',
    title: 'Game Development Pipeline using Godot Engine',
    description: 'From asset import to export builds: a full small-game pipeline in Godot.',
    speaker: { name: 'Paolo Mendoza', role: 'Game Designer' },
    venue: 'Audio-Visual Room 1',
    department: EMC,
    topics: ['game development', 'godot'],
    startOffsetMin: 7 * DAY_MIN,
    durationMin: 240,
    capacity: 90,
    registeredCount: 72,
  },
  {
    id: 'design-systems',
    title: 'Design Systems for Student Products',
    description: 'Tokens, components, and documentation that keep a small team consistent.',
    speaker: { name: 'Engr. Alyssa Valdez', role: 'Lead Solutions Architect' },
    venue: 'CCS Multimedia Room 302',
    department: EMC,
    topics: ['design systems', 'frontend'],
    startOffsetMin: 9 * DAY_MIN,
    durationMin: 180,
    capacity: 60,
    registeredCount: 40,
    overview: 'How to build and maintain a shared design system on a student project.',
    objectives: ['Define tokens and naming.', 'Document components for reuse.'],
  },
  // MOCK: ended 20 minutes ago, so it is "recently finished" (the Time-Out scan is still pending).
  {
    id: 'devsecops-basics',
    title: 'DevSecOps Basics for Student Teams',
    description: 'Adding security checks to a student project pipeline without slowing the team down.',
    speaker: { name: 'Engr. Ronald Navarro', role: 'Data Engineer' },
    venue: 'CCS Main Amphitheater',
    department: IT,
    topics: ['security', 'devops'],
    startOffsetMin: -230,
    durationMin: 210,
    capacity: 100,
    registeredCount: 88,
  },
  // MOCK: finished 12 days ago with a Time-Out that has not been validated yet.
  {
    id: 'iot-prototyping',
    title: 'IoT Prototyping with ESP32',
    description: 'Sensors, Wi-Fi, and a first dashboard on a low-cost microcontroller.',
    speaker: { name: 'Engr. Camille Ortega', role: 'Embedded Systems Engineer' },
    venue: 'CCS Electronics Lab',
    department: IT,
    topics: ['iot', 'embedded'],
    startOffsetMin: -12 * DAY_MIN,
    durationMin: 180,
    capacity: 60,
    registeredCount: 55,
  },
];

export function buildSeminars(base: number): Seminar[] {
  const year = new Date(base).getFullYear();
  return SEEDS.map((seed, index) => ({
    id: seed.id,
    reference: `CCS-${year}-${String(80 + index).padStart(3, '0')}`,
    title: seed.title,
    description: seed.description,
    overview: seed.overview,
    objectives: seed.objectives,
    venueGuidelines: seed.venueGuidelines,
    speaker: seed.speaker,
    venue: seed.venue,
    department: seed.department,
    topics: seed.topics,
    startsAt: iso(base, seed.startOffsetMin),
    endsAt: iso(base, seed.startOffsetMin + seed.durationMin),
    capacity: seed.capacity,
    registeredCount: seed.registeredCount,
    requiredAttendancePercent: REQUIRED_ATTENDANCE_PERCENT,
    curriculumCredit: seed.curriculumCredit,
    organizingBody: 'CCS Student Council',
    certificateEligibility: seed.certificateEligibility,
  }));
}

/** Seminars the mock student is already registered for, keyed by seminar id. */
export function buildRegistrations(base: number): Record<string, Registration> {
  const year = new Date(base).getFullYear();
  const reference = (n: number) => `SEM-${year}-${String(n).padStart(4, '0')}`;
  const completed = (startOffset: number, referenceNumber: number): Registration => ({
    reference: reference(referenceNumber),
    registeredAt: iso(base, startOffset - 3 * DAY_MIN),
    timeIn: { at: iso(base, startOffset + 8), station: 'Marshal station A' },
    timeOut: { at: iso(base, startOffset + 178), validated: true },
    evaluationSubmittedAt: iso(base, startOffset + 200),
    certificateIssuedAt: iso(base, startOffset + DAY_MIN),
  });

  return {
    microfrontends: {
      reference: reference(941),
      registeredAt: iso(base, -3 * DAY_MIN),
      timeIn: { at: iso(base, -33), station: 'Marshal station A' },
      timeOut: null,
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
    'cyber-ir': {
      reference: reference(912),
      registeredAt: iso(base, -5 * DAY_MIN),
      timeIn: { at: iso(base, -380), station: 'Marshal station A' },
      timeOut: { at: iso(base, -182), validated: true },
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
    'responsible-ai': completed(-8 * DAY_MIN, 870),
    'agile-delivery': completed(-15 * DAY_MIN, 801),
    'ux-research': {
      reference: reference(755),
      registeredAt: iso(base, -25 * DAY_MIN),
      timeIn: { at: iso(base, -22 * DAY_MIN + 8), station: 'Marshal station B' },
      timeOut: null,
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
    // MOCK: attended 100 of 240 minutes, so attendance is below the required percentage.
    'data-pipelines': {
      reference: reference(702),
      registeredAt: iso(base, -23 * DAY_MIN),
      timeIn: { at: iso(base, -20 * DAY_MIN + 15), station: 'Marshal station A' },
      timeOut: { at: iso(base, -20 * DAY_MIN + 115), validated: true },
      evaluationSubmittedAt: iso(base, -20 * DAY_MIN + 130),
      certificateIssuedAt: null,
    },
    'devsecops-basics': {
      reference: reference(975),
      registeredAt: iso(base, -2 * DAY_MIN),
      timeIn: { at: iso(base, -220), station: 'Marshal station A' },
      timeOut: null,
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
    'iot-prototyping': {
      reference: reference(940),
      registeredAt: iso(base, -15 * DAY_MIN),
      timeIn: { at: iso(base, -12 * DAY_MIN + 10), station: 'Marshal station B' },
      timeOut: { at: iso(base, -12 * DAY_MIN + 175), validated: false },
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
    'design-systems': {
      reference: reference(960),
      registeredAt: iso(base, -DAY_MIN),
      timeIn: null,
      timeOut: null,
      evaluationSubmittedAt: null,
      certificateIssuedAt: null,
    },
  };
}
