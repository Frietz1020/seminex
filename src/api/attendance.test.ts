import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { acknowledgeAttendance, issueAttendanceChallenge, listOrgRoster, recordOrgChallengeScan, recordOrgScan, uploadWebinarProof } from './attendance';

describe('Supabase attendance adapter', () => {
  beforeEach(() => mocks.getSupabaseClient.mockReset());

  it('persists attendance acknowledgement through the ownership-scoped RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: undefined, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await acknowledgeAttendance('seminar-1');

    expect(client.rpc).toHaveBeenCalledWith('acknowledge_attendance', { p_seminar_id: 'seminar-1' });
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it.each([
    [{ message: 'session_expired', code: 'P0001' }, 'session_expired'],
    [{ message: 'not_available', code: 'P0001' }, 'not_available'],
    [{ message: 'permission denied', code: '42501' }, 'forbidden'],
  ] as const)('maps acknowledgement database error %s', async (error, code) => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

    await expect(acknowledgeAttendance('seminar-1')).resolves.toEqual({ ok: false, error: { code } });
  });

  it('maps a rejected acknowledgement request to a network error', async () => {
    mocks.getSupabaseClient.mockReturnValue({ rpc: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(acknowledgeAttendance('seminar-1')).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });

  it('maps the server-created punch and roster identity returned by the scan RPC', async () => {
    const eventAt = '2026-11-06T08:00:00.000Z';
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          entry: {
            id: 'ledger-1', seminar_id: 'seminar-1', student_user_id: 'student-1', kind: 'time_in',
            event_at: eventAt, method: 'manual', officer_user_id: 'officer-1', officer_name: 'Officer One', reason: 'Verified identity',
          },
          student: {
            studentId: '207000711', firstName: 'Attendee', lastName: 'Student', middleInitial: 'A',
            program: 'IT', yearLevel: 3, block: 'A', avatarUrl: null,
          },
        },
        error: null,
      }),
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await recordOrgScan({
      seminarId: 'seminar-1', studentId: '207000711', method: 'manual', idempotencyKey: 'request-1', reason: 'Verified identity',
    });

    expect(client.rpc).toHaveBeenCalledWith('record_org_scan', expect.objectContaining({ p_idempotency_key: 'request-1' }));
    expect(result).toMatchObject({
      ok: true,
      data: {
        entry: { at: eventAt, kind: 'time_in', officerId: 'officer-1', officerName: 'Officer One' },
        student: { studentId: '207000711', firstName: 'Attendee', lastName: 'Student', program: 'IT', yearLevel: 3, block: 'A' },
      },
    });
  });

  it('requests an uncached, short-lived challenge from the authenticated RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { challenge: 'a'.repeat(64), expires_at: '2026-11-06T08:00:30Z' }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);
    await expect(issueAttendanceChallenge('seminar-1')).resolves.toEqual({ ok: true, data: { challenge: 'a'.repeat(64), expiresAt: '2026-11-06T08:00:30Z' } });
    expect(client.rpc).toHaveBeenCalledWith('issue_attendance_challenge', { p_seminar_id: 'seminar-1' });
  });

  it('sends only an opaque challenge and seminar context to the challenge scan RPC', async () => {
    const eventAt = '2026-11-06T08:00:00.000Z';
    const client = { rpc: vi.fn().mockResolvedValue({ data: {
      entry: { id: 'ledger-2', seminar_id: 'seminar-1', student_user_id: 'student-1', kind: 'time_in', event_at: eventAt, method: 'qr', officer_user_id: 'officer-1', officer_name: 'Officer One', reason: null },
      student: { studentId: '207000711', firstName: 'Attendee', lastName: 'Student', middleInitial: '', program: 'IT', yearLevel: 3, block: 'A' },
    }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);
    const result = await recordOrgChallengeScan({ seminarId: 'seminar-1', challenge: 'b'.repeat(64), idempotencyKey: 'request-2' });
    expect(client.rpc).toHaveBeenCalledWith('record_org_challenge_scan', { p_seminar_id: 'seminar-1', p_challenge: 'b'.repeat(64), p_idempotency_key: 'request-2' });
    expect(JSON.stringify(client.rpc.mock.calls[0])).not.toContain('207000711');
    expect(result).toMatchObject({ ok: true, data: { entry: { kind: 'time_in' }, student: { studentId: '207000711' } } });
  });

  it('rejects malformed challenge input before calling Supabase', async () => {
    const client = { rpc: vi.fn() };
    mocks.getSupabaseClient.mockReturnValue(client);
    await expect(recordOrgChallengeScan({ seminarId: 'seminar-1', challenge: '202410770', idempotencyKey: 'request-3' })).resolves.toEqual({ ok: false, error: { code: 'validation_failed' } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('signs roster avatar paths before returning them to the org UI', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [{
        id: 'registration-1', seminar_id: 'seminar-1', student_id: '207000711', first_name: 'Attendee',
        last_name: 'Student', middle_initial: '', program: 'IT', year_level: 3, block: 'A', email: 'student@example.test',
        avatar_url: 'student-1/avatar.png', registered_at: '2026-11-06T07:00:00Z', status: 'confirmed',
      }], error: null }),
      storage: { from: vi.fn(() => ({ createSignedUrls: vi.fn().mockResolvedValue({
        data: [{ path: 'student-1/avatar.png', signedUrl: 'https://storage.example.test/avatar?token=short' }], error: null,
      }) })) },
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await listOrgRoster('seminar-1');

    expect(result.ok && result.data[0]?.avatarUrl).toBe('https://storage.example.test/avatar?token=short');
  });

  it('sends webinar proof as multipart file and returns a signed private image URL', async () => {
    const client = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: { proof: {
        id: 'proof-1', seminar_id: 'seminar-1', student_id: 'student-1', kind: 'time_in',
        object_path: 'student-1/seminar-1/proof.png', submitted_at: '2026-11-06T08:00:00Z', status: 'pending',
      } }, error: null }) },
      storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.test/proof?token=short' }, error: null,
      }) })) },
    };
    mocks.getSupabaseClient.mockReturnValue(client);
    const file = new File([new Uint8Array([1, 2, 3])], 'proof.png', { type: 'image/png' });

    const result = await uploadWebinarProof('seminar-1', 'time_in', file);

    const form = client.functions.invoke.mock.calls[0]?.[1].body as FormData;
    expect(form.get('file')).toMatchObject({ name: 'proof.png', size: 3, type: 'image/png' });
    expect(form.get('seminarId')).toBe('seminar-1');
    expect(result).toMatchObject({ ok: true, data: { imageUrl: 'https://storage.example.test/proof?token=short' } });
  });
});
