import type { DraftReadiness, ReadinessItem, SeminarDetailsDraft, SeminarDraft } from '../../api/orgTypes';

/** The detail fields a draft needs before it can be published, in the order the wizard asks for them. */
const REQUIRED_DETAILS: ReadonlyArray<{ key: keyof SeminarDetailsDraft; label: string }> = [
  { key: 'title', label: 'title' },
  { key: 'description', label: 'description' },
  { key: 'speakerName', label: 'speaker name' },
  { key: 'speakerRole', label: 'speaker role' },
  { key: 'venue', label: 'venue' },
  { key: 'department', label: 'department' },
  { key: 'startsAt', label: 'start time' },
  { key: 'endsAt', label: 'end time' },
  { key: 'capacity', label: 'capacity' },
];

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return false;
}

/** Names the missing detail fields, or returns an empty list. Also flags an end time that is not after the start. */
export function getMissingDetails(details: SeminarDetailsDraft): string[] {
  const missing = REQUIRED_DETAILS.filter(({ key }) => !isFilled(details[key])).map(({ label }) => label);
  if (details.startsAt && details.endsAt && Date.parse(details.endsAt) <= Date.parse(details.startsAt)) {
    missing.push('an end time after the start time');
  }
  return missing;
}

/**
 * The publish checklist. It is computed from the draft every time and never stored, so it cannot go
 * stale. There is no approval step: a draft is ready when all three items pass.
 */
export function getDraftReadiness(draft: SeminarDraft): DraftReadiness {
  const missing = getMissingDetails(draft.details);
  const hasQuestions = draft.survey?.sections.some((section) => section.questions.length > 0) ?? false;

  const items: ReadinessItem[] = [
    {
      id: 'details',
      label: 'Details complete',
      passed: missing.length === 0,
      reason: missing.length === 0 ? '' : `Add ${missing.join(', ')}.`,
    },
    {
      id: 'certificate',
      label: 'Certificate template set',
      passed: draft.certificate !== null,
      reason: draft.certificate !== null ? '' : 'Upload a certificate template and place the name box.',
    },
    {
      id: 'survey',
      label: 'Evaluation survey set',
      passed: hasQuestions,
      reason: hasQuestions ? '' : 'Add at least one evaluation question.',
    },
  ];

  const firstFailing = items.find((item) => !item.passed);
  return { items, ready: !firstFailing, firstBlockingReason: firstFailing ? firstFailing.reason : null };
}