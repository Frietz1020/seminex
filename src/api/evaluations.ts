import { getSupabaseClient } from './supabaseClient';
import type {
  ApiErrorCode,
  ApiResult,
  CursorPage,
  CursorPageRequest,
  EvaluationAnswers,
  EvaluationDue,
  SubmitEvaluationResult,
  Survey,
} from './types';
import type {
  AuthoredSurvey,
  OrgSeminarEvaluationData,
  QuestionAggregate,
  SurveyAggregate,
  SurveyResponse,
} from './orgTypes';

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(error: DbError): ApiErrorCode {
  const message = error.message.toLowerCase();
  const known: ApiErrorCode[] = ['validation_failed', 'conflict', 'rate_limited', 'not_available', 'not_found', 'forbidden', 'session_expired', 'network'];
  const match = known.find((code) => message.includes(code));
  if (match) return match;
  if (error.code === '23514' || error.code === '22P02') return 'validation_failed';
  if (error.code === '42501') return 'forbidden';
  if (error.code === 'PGRST116') return 'not_found';
  return 'network';
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

function surveyFromRow(value: unknown): Survey | null {
  if (!isRow(value) || typeof value.id !== 'string' || typeof value.seminarId !== 'string'
    || !Number.isInteger(value.version) || typeof value.title !== 'string'
    || typeof value.instructions !== 'string' || !Array.isArray(value.sections)) return null;
  if (value.sections.some((section) => !isRow(section) || typeof section.id !== 'string'
    || typeof section.title !== 'string' || !Array.isArray(section.questions))) return null;
  return {
    id: value.id,
    version: value.version as number,
    seminarId: value.seminarId,
    sections: value.sections as Survey['sections'],
  };
}

function authoredSurveyFromRow(value: unknown): AuthoredSurvey | null {
  const survey = surveyFromRow(value);
  if (!survey || !isRow(value) || typeof value.title !== 'string' || typeof value.instructions !== 'string') return null;
  return { ...survey, title: value.title, instructions: value.instructions, sections: value.sections as AuthoredSurvey['sections'] };
}

function responseFromRow(value: unknown): SurveyResponse | null {
  if (!isRow(value) || typeof value.id !== 'string' || typeof value.seminarId !== 'string'
    || typeof value.surveyId !== 'string' || !Number.isInteger(value.surveyVersion)
    || !isRow(value.answers) || Object.values(value.answers).some((answer) => typeof answer !== 'string')) return null;
  return {
    id: value.id,
    seminarId: value.seminarId,
    surveyId: value.surveyId,
    surveyVersion: value.surveyVersion as number,
    answers: value.answers as EvaluationAnswers,
  };
}

function questionAggregateFromRow(value: unknown): QuestionAggregate | null {
  if (!isRow(value) || typeof value.questionId !== 'string' || typeof value.prompt !== 'string'
    || typeof value.type !== 'string' || !Number.isInteger(value.responseCount)) return null;
  return value as unknown as QuestionAggregate;
}

function aggregateFromRow(value: unknown): SurveyAggregate | null {
  if (!isRow(value) || typeof value.seminarId !== 'string' || typeof value.surveyId !== 'string'
    || !Number.isInteger(value.surveyVersion) || !Number.isInteger(value.responseCount)
    || !Number.isInteger(value.eligibleCount) || !Number.isInteger(value.completionRate)
    || !Array.isArray(value.questions)) return null;
  const questions = value.questions.map(questionAggregateFromRow);
  if (questions.some((question) => question === null)) return null;
  return { ...value, questions: questions as QuestionAggregate[] } as SurveyAggregate;
}

function encodeCursor(id: string): string {
  return encodeURIComponent(JSON.stringify({ id }));
}

function decodeCursor(cursor: string | undefined): { id: string } | null | false {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cursor));
    if (!isRow(parsed) || typeof parsed.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.id)) return false;
    return { id: parsed.id };
  } catch {
    return false;
  }
}

function cursorPageFromRow<T>(value: unknown, map: (row: unknown) => T | null): CursorPage<T> | null {
  if (!isRow(value) || !Array.isArray(value.items) || typeof value.nextCursor !== 'object' && value.nextCursor !== null) return null;
  const items = value.items.map(map);
  if (items.some((item) => item === null)) return null;
  let nextCursor: string | null = null;
  if (value.nextCursor !== null) {
    if (!isRow(value.nextCursor) || typeof value.nextCursor.id !== 'string') return null;
    nextCursor = encodeCursor(value.nextCursor.id);
  }
  return { items: items as T[], nextCursor };
}

export async function listEvaluationsDue(): Promise<ApiResult<EvaluationDue[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('list_evaluations_due');
    if (error) return failure(apiError(error));
    if (!Array.isArray(data)) return failure('network');
    const due = data.map((row): EvaluationDue | null => {
      if (!isRow(row) || typeof row.seminar_id !== 'string' || typeof row.seminar_title !== 'string') return null;
      return { seminarId: row.seminar_id, seminarTitle: row.seminar_title };
    });
    return due.some((item) => item === null) ? failure('network') : { ok: true, data: due as EvaluationDue[] };
  } catch {
    return failure('network');
  }
}

export async function getEvaluationSurvey(seminarId: string): Promise<ApiResult<Survey>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('get_evaluation_survey', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    const survey = surveyFromRow(data);
    return survey ? { ok: true, data: survey } : failure('network');
  } catch {
    return failure('network');
  }
}

export async function submitEvaluation(
  seminarId: string,
  surveyId: string,
  surveyVersion: number,
  answers: EvaluationAnswers,
): Promise<ApiResult<SubmitEvaluationResult>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('submit_evaluation', {
      p_seminar_id: seminarId,
      p_survey_id: surveyId,
      p_survey_version: surveyVersion,
      p_answers: answers,
    });
    if (error) return failure(apiError(error));
    if (!isRow(data) || typeof data.submittedAt !== 'string') return failure('network');
    const result: SubmitEvaluationResult = {
      submittedAt: data.submittedAt,
      ...(typeof data.certificateSerial === 'string' ? { certificateSerial: data.certificateSerial } : {}),
    };
    if (result.certificateSerial) {
      try {
        await supabase.functions.invoke('issue-certificate', { body: { seminarId } });
      } catch {
        // Evaluation is committed already; a later certificate download retries generation.
      }
    }
    return { ok: true, data: result };
  } catch {
    return failure('network');
  }
}

export async function getOrgSeminarEvaluation(
  seminarId: string,
  request?: CursorPageRequest,
): Promise<ApiResult<OrgSeminarEvaluationData>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const cursor = decodeCursor(request?.cursor);
  if (cursor === false || (request?.pageSize !== undefined && (!Number.isInteger(request.pageSize) || request.pageSize < 1))) {
    return failure('validation_failed');
  }
  const pageSize = Math.min(request?.pageSize ?? 20, 100);
  try {
    const { data, error } = await supabase.rpc('get_org_seminar_evaluation', {
      p_seminar_id: seminarId,
      p_cursor: cursor,
      p_page_size: pageSize,
    });
    if (error) return failure(apiError(error));
    if (!isRow(data) || !Array.isArray(data.surveyVersions) || !Array.isArray(data.aggregates)) return failure('network');
    const survey = data.survey === null ? null : authoredSurveyFromRow(data.survey);
    const surveyVersions = data.surveyVersions.map(authoredSurveyFromRow);
    const aggregates = data.aggregates.map(aggregateFromRow);
    const responses = cursorPageFromRow(data.responses, responseFromRow);
    if ((data.survey !== null && survey === null) || surveyVersions.some((item) => item === null)
      || aggregates.some((item) => item === null) || !responses) return failure('network');
    return {
      ok: true,
      data: {
        survey,
        surveyVersions: surveyVersions as AuthoredSurvey[],
        aggregates: aggregates as SurveyAggregate[],
        responses,
      },
    };
  } catch {
    return failure('network');
  }
}
