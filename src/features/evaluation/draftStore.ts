/**
 * Evaluation drafts live on this device only, in the same per-student offline storage as tickets
 * and the profile, so signing out removes them with everything else.
 */
import {
  cacheEvaluationDraft,
  clearEvaluationDraft,
  readEvaluationDraft,
} from '../../api/offlineCache';
import type { EvaluationAnswers, Survey } from '../../api/types';
import { getSession } from '../../session/storage';
import { sanitizeAnswers } from './validation';

/** Returns true only if the draft can be read back, so the page never claims a save that failed. */
export function saveEvaluationDraft(seminarId: string, survey: Survey, answers: EvaluationAnswers): boolean {
  const student = getSession()?.studentId;
  if (!student) return false;
  const savedAt = new Date().toISOString();
  cacheEvaluationDraft(student, seminarId, { surveyId: survey.id, surveyVersion: survey.version, answers, savedAt });
  return readEvaluationDraft(student, seminarId)?.savedAt === savedAt;
}

/** A draft saved for an older version of the survey is dropped, not restored. */
export function loadEvaluationDraft(seminarId: string, survey: Survey): EvaluationAnswers | null {
  const student = getSession()?.studentId;
  if (!student) return null;
  const draft = readEvaluationDraft(student, seminarId);
  if (!draft) return null;
  if (draft.surveyId !== survey.id || draft.surveyVersion !== survey.version) {
    clearEvaluationDraft(student, seminarId);
    return null;
  }
  const answers = sanitizeAnswers(survey, draft.answers);
  return Object.keys(answers).length > 0 ? answers : null;
}

export function removeEvaluationDraft(seminarId: string): void {
  const student = getSession()?.studentId;
  if (student) clearEvaluationDraft(student, seminarId);
}