import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { getCertificate, getOrgCertificate, getOrgSeminarCertificates } from './certificates';

describe('Supabase certificate adapter', () => {
  beforeEach(() => {
    mocks.getSupabaseClient.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generates or retries own certificate, then downloads authorized private storage as a Blob', async () => {
    const client = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: { status: 'issued', serial: 'SNX-ABC' }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: {
        id: 'issuance-1', seminar_id: 'seminar-1', registration_id: 'registration-1', student_user_id: 'student-1',
        serial: 'SNX-ABC', template_snapshot: {}, status: 'issued', object_path: 'seminar-1/registration-1.pdf',
        issued_at: '2026-11-10T00:00:00.000Z',
      }, error: null }),
      storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/signed.pdf' }, error: null }) })) },
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await getCertificate('seminar-1');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a certificate Blob');
    expect(result.data).toBeInstanceOf(Blob);
    expect(await result.data.text()).toContain('%PDF');
    expect(client.functions.invoke).toHaveBeenCalledWith('issue-certificate', { body: { seminarId: 'seminar-1' } });
    expect(client.rpc).toHaveBeenCalledWith('get_my_certificate', { p_seminar_id: 'seminar-1' });
    expect(client.storage.from).toHaveBeenCalledWith('certificates');
    expect(fetch).toHaveBeenCalledWith('https://storage.example.test/signed.pdf', { cache: 'no-store' });
  });

  it('returns an Edge Function error without falling back to mock data', async () => {
    const context = new Response(JSON.stringify({ code: 'not_available' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context } }) } };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(getCertificate('seminar-1')).resolves.toEqual({ ok: false, error: { code: 'not_available' } });
  });

  it('maps organization certificate rows and keeps override request list empty', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: {
      template: {
        backgroundUrl: 'data:image/png;base64,AA==',
        nameBox: { x: 10, y: 20, width: 200, height: 40, fontFamily: 'Outfit', fontSize: 24, fontWeight: 700, align: 'center', color: '#1B365D' },
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
      records: [{ id: 'registration-1', seminarId: 'seminar-1', studentId: '209000001', state: 'issued', reason: 'Certificate issued.', issuedAt: '2026-11-10T00:00:00.000Z', serial: 'SNX-ABC' }],
      overrideRequests: [],
    }, error: null }) };
    mocks.getSupabaseClient.mockReturnValue(client);

    await expect(getOrgSeminarCertificates('seminar-1')).resolves.toMatchObject({
      ok: true,
      data: { records: [{ id: 'registration-1', state: 'issued', serial: 'SNX-ABC' }], overrideRequests: [] },
    });
    expect(client.rpc).toHaveBeenCalledWith('get_org_seminar_certificates', { p_seminar_id: 'seminar-1' });
  });

  it('downloads only an issued certificate visible through the caller RLS policy', async () => {
    const eq = vi.fn().mockReturnThis();
    const maybeSingle = vi.fn().mockResolvedValue({ data: { status: 'issued', object_path: 'seminar-1/registration-1.pdf' }, error: null });
    const signed = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/org.pdf' }, error: null });
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq, maybeSingle })) })) })),
      storage: { from: vi.fn(() => ({ createSignedUrl: signed })) },
    };
    mocks.getSupabaseClient.mockReturnValue(client);

    const result = await getOrgCertificate('seminar-1', 'registration-1');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected an organization certificate Blob');
    expect(result.data).toBeInstanceOf(Blob);
    expect(client.from).toHaveBeenCalledWith('certificate_issuances');
    expect(signed).toHaveBeenCalledWith('seminar-1/registration-1.pdf', 60);
  });
});
