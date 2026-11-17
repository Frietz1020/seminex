import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { getEvaluationSurvey, getOrgSeminarEvaluation, listEvaluationsDue, submitEvaluation } from './evaluations';

describe('Supabase evaluation adapter', () => {
  beforeEach(() => mocks.getSupabaseClient.mockReset());

  it('maps due evaluations from the database response', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [{ seminar_id: 'seminar-1', seminar_title: 'Seminar One' }], error: null }),
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(listEvaluationsDue()).resolves.toEqual({
      ok: true,
      data: [{ seminarId: 'seminar-1', seminarTitle: 'Seminar One' }],
    });
    expect(client.rpc).toHaveBeenCalledWith('list_evaluations_due');
  });

  it('returns the server-published survey snapshot for an eligible student', async () => {
    const survey = {
      id: 'survey-1',
      version: 2,
      seminarId: 'seminar-1',
      title: 'Evaluation',
      instructions: '',
      sections: [{ id: 'section-1', title: 'Main', questions: [] }],
    };
    const client = { rpc: vi.fn().mockResolvedValue({ data: survey, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(getEvaluationSurvey('seminar-1')).resolves.toEqual({ ok: true, data: {
      id: survey.id, version: survey.version, seminarId: survey.seminarId, sections: survey.sections,
    } });
    expect(client.rpc).toHaveBeenCalledWith('get_evaluation_survey', { p_seminar_id: 'seminar-1' });
  });

  it('maps a rejected duplicate submission to the conflict API error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'conflict' } }),
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(submitEvaluation('seminar-1', 'survey-1', 2, { q1: '4' })).resolves.toEqual({
      ok: false,
      error: { code: 'conflict' },
    });
  });

  it('returns the server serial and requests certificate generation without failing a committed evaluation', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: {
        submittedAt: '2026-11-10T00:00:00.000Z', certificateSerial: 'SNX-ABC',
      }, error: null }),
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: 'temporary renderer outage' } }) },
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(submitEvaluation('seminar-1', 'survey-1', 2, { q1: '4' })).resolves.toEqual({
      ok: true,
      data: { submittedAt: '2026-11-10T00:00:00.000Z', certificateSerial: 'SNX-ABC' },
    });
    expect(client.functions.invoke).toHaveBeenCalledWith('issue-certificate', { body: { seminarId: 'seminar-1' } });
  });

  it('maps anonymized aggregate totals and paginated responses for each survey version', async () => {
    const oldSurvey = { id: 'survey-1', version: 1, seminarId: 'seminar-1', title: 'First', instructions: '', sections: [{ id: 'section-1', title: 'Main', questions: [{ id: 'old-q', type: 'paragraph', prompt: 'Old question', required: false, maxLength: 30 }] }] };
    const currentSurvey = { id: 'survey-1', version: 2, seminarId: 'seminar-1', title: 'Current', instructions: '', sections: [{ id: 'section-2', title: 'Main', questions: [{ id: 'new-q', type: 'scale', prompt: 'Current question', required: true, min: 1, max: 5, startLabel: 'Low', endLabel: 'High' }] }] };
    const response = { id: '00000000-0000-4000-8000-000000000981', seminarId: 'seminar-1', surveyId: 'survey-1', surveyVersion: 1, respondentLabel: 'Attendee #01', submittedAt: '2026-11-09T04:00:00.000Z', answers: { 'old-q': 'Useful' } };
    const client = { rpc: vi.fn().mockResolvedValue({ data: {
      survey: currentSurvey,
      surveyVersions: [oldSurvey, currentSurvey],
      aggregates: [{ seminarId: 'seminar-1', surveyId: 'survey-1', surveyVersion: 1, responseCount: 1, eligibleCount: 4, completionRate: 25, questions: [{ questionId: 'old-q', prompt: 'Old question', type: 'paragraph', responseCount: 1, comments: ['Useful'] }] }],
      responses: { items: [response], nextCursor: { id: response.id } },
    }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await getOrgSeminarEvaluation('seminar-1', { pageSize: 1 });

    expect(result).toMatchObject({ ok: true, data: {
      survey: { version: 2 },
      surveyVersions: [{ version: 1 }, { version: 2 }],
      aggregates: [{ surveyVersion: 1, responseCount: 1, eligibleCount: 4, completionRate: 25, questions: [{ questionId: 'old-q', comments: ['Useful'] }] }],
      responses: { items: [{ id: response.id, surveyVersion: 1, answers: { 'old-q': 'Useful' } }], nextCursor: expect.any(String) },
    } });
    expect(client.rpc).toHaveBeenCalledWith('get_org_seminar_evaluation', {
      p_seminar_id: 'seminar-1', p_cursor: null, p_page_size: 1,
    });
    if (!result.ok) throw new Error('Expected an evaluation response page');
    expect(result.data.responses.nextCursor).toBe(encodeURIComponent(JSON.stringify({ id: response.id })));
    expect(result.data.responses.items[0]).not.toHaveProperty('respondentLabel');
    expect(result.data.responses.items[0]).not.toHaveProperty('submittedAt');

    await getOrgSeminarEvaluation('seminar-1', { cursor: result.data.responses.nextCursor ?? undefined, pageSize: 1 });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'get_org_seminar_evaluation', {
      p_seminar_id: 'seminar-1', p_cursor: { id: response.id }, p_page_size: 1,
    });
  });
});
