import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CursorPageRequest } from './types';

const mocked = vi.hoisted(() => ({ getSupabaseClient: vi.fn(), getServerTime: vi.fn() }));
vi.mock('./supabaseClient', () => mocked);
vi.mock('./serverTime', () => ({ getServerTime: mocked.getServerTime }));

import {
  createOrgEditDraft,
  getTicket,
  listAvailableSeminars,
  listHistory,
  listMySeminars,
  listOrgSeminars,
  registerForSeminar,
  uploadOrgSeminarCover,
  removeOrgSeminarCover,
} from './seminars';

type Result = { data: unknown; error: null | { code?: string; message: string } };

function query(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'is', 'ilike', 'or', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'lte']) {
    calls[method] = [];
    builder[method] = vi.fn((...args: unknown[]) => {
      calls[method]?.push(args);
      return builder;
    });
  }
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(resolve(result));
  return { builder, calls };
}

function seminarRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seminar-1',
    organization_id: 'org-1',
    reference: 'SEM-0001',
    title: 'Systems Seminar',
    description: 'A systems session',
    overview: null,
    objectives: [],
    seminar_type: 'seminar',
    speaker_name: 'Alex Speaker',
    speaker_role: 'Engineer',
    venue: 'CCS Hall',
    venue_guidelines: null,
    department: 'CCS',
    topics: ['systems'],
    starts_at: '2027-01-02T02:00:00.000Z',
    ends_at: '2027-01-02T04:00:00.000Z',
    capacity: 40,
    registered_count: 12,
    required_attendance_percent: 60,
    confirmation_opens_hours_before: 24,
    confirmation_closes_hours_before: 1,
    image_url: null,
    curriculum_credit: null,
    organizing_body: null,
    certificate_eligibility: null,
    publication_status: 'published',
    published_at: '2026-10-01T00:00:00.000Z',
    join_url: 'https://meet.example.test/private',
    ...overrides,
  };
}

function makeClient(tables: Record<string, ReturnType<typeof query>>, rpcResult: Result = { data: null, error: null }) {
  return {
    from: vi.fn((table: string) => tables[table]?.builder),
    rpc: vi.fn(async () => rpcResult),
    storage: { from: vi.fn() },
    auth: { getUser: vi.fn(async (): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> => ({ data: { user: { id: 'user-1' } }, error: null })) },
  };
}

describe('Supabase seminar API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads a cover under the organization and draft returned by RLS', async () => {
    const drafts = query({ data: { organization_id: 'org-1' }, error: null });
    const upload = vi.fn(async () => ({ data: { path: 'ignored' }, error: null }));
    const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://project.test/storage/v1/object/public/seminar-covers/${path}` } }));
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn(() => ({ upload, getPublicUrl, remove: vi.fn() })) as typeof client.storage.from;
    mocked.getSupabaseClient.mockReturnValue(client);

    const result = await uploadOrgSeminarCover('draft-1', new File(['cover'], 'cover.png', { type: 'image/png' }));

    expect(drafts.calls.eq).toContainEqual(['id', 'draft-1']);
    expect(drafts.calls.is).toContainEqual(['published_seminar_id', null]);
    expect(upload).toHaveBeenCalledOnce();
    const [objectPath, file, options] = upload.mock.calls[0] as unknown as [string, File, { contentType: string; upsert: boolean }];
    expect(objectPath).toMatch(/^org-1\/draft-1\/[0-9a-f-]+\.png$/i);
    expect(file).toBeInstanceOf(File);
    expect(options).toEqual({ contentType: 'image/png', upsert: false });
    expect(result).toEqual({ ok: true, data: { publicUrl: `https://project.test/storage/v1/object/public/seminar-covers/${objectPath}`, objectPath } });
  });

  it.each([
    ['image/gif', 1],
    ['image/png', 0],
    ['image/jpeg', 5 * 1024 * 1024 + 1],
  ])('rejects invalid cover files before Storage calls', async (type, size) => {
    const drafts = query({ data: { organization_id: 'org-1' }, error: null });
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn();
    mocked.getSupabaseClient.mockReturnValue(client);
    const file = new File([new Uint8Array(size)], 'cover.bin', { type });

    await expect(uploadOrgSeminarCover('draft-1', file)).resolves.toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('does not upload when the draft is missing or already published', async () => {
    const drafts = query({ data: null, error: null });
    const client = makeClient({ seminar_drafts: drafts });
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(uploadOrgSeminarCover('draft-1', new File(['cover'], 'cover.png', { type: 'image/png' }))).resolves.toEqual({ ok: false, error: { code: 'not_found' } });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('returns storage upload authorization errors without exposing a public URL', async () => {
    const drafts = query({ data: { organization_id: 'org-1' }, error: null });
    const upload = vi.fn(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn(() => ({ upload, getPublicUrl: vi.fn(), remove: vi.fn() })) as typeof client.storage.from;
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(uploadOrgSeminarCover('draft-1', new File(['cover'], 'cover.png', { type: 'image/png' }))).resolves.toEqual({ ok: false, error: { code: 'forbidden' } });
    expect(upload).toHaveBeenCalledOnce();
  });

  it('removes a valid cover object only under the visible unpublished draft', async () => {
    const drafts = query({ data: { organization_id: '00000000-0000-4000-8000-000000000821' }, error: null });
    const remove = vi.fn(async () => ({ data: [], error: null }));
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(), remove })) as typeof client.storage.from;
    mocked.getSupabaseClient.mockReturnValue(client);
    const objectPath = '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000841/00000000-0000-4000-8000-000000000851.webp';

    await expect(removeOrgSeminarCover('00000000-0000-4000-8000-000000000841', objectPath)).resolves.toEqual({ ok: true, data: undefined });
    expect(client.storage.from).toHaveBeenCalledWith('seminar-covers');
    expect(remove).toHaveBeenCalledWith([objectPath]);
  });

  it('rejects removal outside the requested draft before calling Storage', async () => {
    const drafts = query({ data: { organization_id: 'org-1' }, error: null });
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn();
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(removeOrgSeminarCover('draft-1', 'org-2/draft-2/cover.png')).resolves.toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('rejects non-versioned filenames even under the visible draft path', async () => {
    const organizationId = '00000000-0000-4000-8000-000000000821';
    const draftId = '00000000-0000-4000-8000-000000000841';
    const drafts = query({ data: { organization_id: organizationId }, error: null });
    const client = makeClient({ seminar_drafts: drafts });
    client.storage.from = vi.fn(() => ({ remove: vi.fn(async () => ({ data: [], error: null })) })) as typeof client.storage.from;
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(removeOrgSeminarCover(draftId, `${organizationId}/${draftId}/------------------------------------.png`)).resolves.toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('returns the ticket only for the authenticated student active registration', async () => {
    const registrations = query({ data: {
      seminar_id: 'seminar-1', student_user_id: 'user-1', status: 'confirmed', registered_at: '2026-11-06T07:00:00Z',
    }, error: null });
    const profiles = query({ data: { student_id: '207000711' }, error: null });
    const client = makeClient({ registration_read_model: registrations, profiles });
    mocked.getSupabaseClient.mockReturnValue(client);

    const result = await getTicket('seminar-1');

    expect(registrations.calls.eq).toContainEqual(['seminar_id', 'seminar-1']);
    expect(registrations.calls.eq).toContainEqual(['student_user_id', 'user-1']);
    expect(profiles.calls.eq).toContainEqual(['id', 'user-1']);
    expect(result).toEqual({ ok: true, data: {
      seminarId: 'seminar-1', studentId: '207000711', issuedAt: '2026-11-06T07:00:00Z',
    } });
  });

  it.each(['registered', 'confirmed'])('allows an active %s registration', async (status) => {
    const registrations = query({ data: {
      seminar_id: 'seminar-1', student_user_id: 'user-1', status, registered_at: '2026-11-06T07:00:00Z',
    }, error: null });
    const profiles = query({ data: { student_id: '207000711' }, error: null });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ registration_read_model: registrations, profiles }));

    expect(await getTicket('seminar-1')).toMatchObject({ ok: true, data: { studentId: '207000711' } });
  });

  it.each([
    null,
    { seminar_id: 'seminar-1', student_user_id: 'user-1', status: 'released', registered_at: '2026-11-06T07:00:00Z' },
    { seminar_id: 'seminar-1', student_user_id: 'user-1', status: 'cancelled', registered_at: '2026-11-06T07:00:00Z' },
  ])(
    'hides missing or released registrations', async (registration) => {
      mocked.getSupabaseClient.mockReturnValue(makeClient({
        registration_read_model: query({ data: registration, error: null }),
        profiles: query({ data: { student_id: '207000711' }, error: null }),
      }));

      expect(await getTicket('seminar-1')).toEqual({ ok: false, error: { code: 'not_found' } });
    },
  );

  it('requires a signed-in user before reading a ticket', async () => {
    const client = makeClient({});
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocked.getSupabaseClient.mockReturnValue(client);

    expect(await getTicket('seminar-1')).toEqual({ ok: false, error: { code: 'session_expired' } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: '42501', message: 'permission denied' }, 'forbidden'],
    [{ code: '08006', message: 'connection failure' }, 'network'],
  ] as const)('maps ticket database errors %s', async (error, code) => {
    const registrations = query({ data: null, error });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ registration_read_model: registrations }));

    expect(await getTicket('seminar-1')).toEqual({ ok: false, error: { code } });
  });

  it('treats an unrecognized returned database error as a definite rejection', async () => {
    const registrations = query({ data: null, error: { code: 'PGRST204', message: 'unexpected database error' } });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ registration_read_model: registrations }));

    expect(await getTicket('seminar-1')).toEqual({ ok: false, error: { code: 'validation_failed' } });
  });

  it('uses the authoritative server sample for the history cutoff', async () => {
    const now = '2026-11-09T10:00:00.000Z';
    mocked.getServerTime.mockResolvedValue({ ok: true, data: { now } });
    const registrations = query({ data: [], error: null });
    const client = makeClient({ registration_read_model: registrations });
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(listHistory()).resolves.toMatchObject({ ok: true, data: { items: [] } });

    expect(mocked.getServerTime).toHaveBeenCalledOnce();
    expect(registrations.calls.lte).toContainEqual(['seminar_ends_at', '2026-11-09T09:00:00.000Z']);
  });

  it('does not use device time for history when the server clock is unavailable', async () => {
    mocked.getServerTime.mockResolvedValue({ ok: false, error: { code: 'network' } });
    const client = makeClient({});
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(listHistory()).resolves.toEqual({ ok: false, error: { code: 'network' } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('reads only published catalog fields, maps the slot count, and returns a cursor', async () => {
    const catalog = query({ data: [seminarRow(), seminarRow({ id: 'seminar-2', reference: 'SEM-0002', starts_at: '2027-01-03T02:00:00.000Z' })], error: null });
    const registrations = query({ data: [], error: null });
    const client = makeClient({ seminars: catalog, registration_read_model: registrations });
    mocked.getSupabaseClient.mockReturnValue(client);

    const request: CursorPageRequest = { pageSize: 1, search: 'Systems' };
    const result = await listAvailableSeminars(request);

    expect(catalog.calls.eq).toContainEqual(['publication_status', 'published']);
    expect(catalog.calls.ilike).toContainEqual(['title', '%Systems%']);
    expect(String(catalog.calls.select?.[0]?.[0])).not.toContain('join_url');
    expect(result).toMatchObject({
      ok: true,
      data: {
        items: [{ seminar: { id: 'seminar-1', registeredCount: 12 }, registration: null }],
        nextCursor: expect.any(String),
      },
    });
  });

  it('returns configuration_error when Supabase is unavailable', async () => {
    mocked.getSupabaseClient.mockReturnValue(null);
    await expect(listAvailableSeminars()).resolves.toEqual({ ok: false, error: { code: 'configuration_error' } });
  });

  it('does not hide an authentication lookup failure as an anonymous catalog read', async () => {
    const catalog = query({ data: [seminarRow()], error: null });
    const registrations = query({ data: [], error: null });
    const client = makeClient({ seminars: catalog, registration_read_model: registrations });
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Auth service unavailable' } });
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(listAvailableSeminars()).resolves.toEqual({ ok: false, error: { code: 'network' } });
  });

  it('maps the atomic registration capacity error', async () => {
    const client = makeClient({}, { data: null, error: { code: 'P0001', message: 'seminar_full' } });
    mocked.getSupabaseClient.mockReturnValue(client);

    await expect(registerForSeminar('seminar-1')).resolves.toEqual({ ok: false, error: { code: 'seminar_full' } });
    expect(client.rpc).toHaveBeenCalledWith('register_for_seminar', { p_seminar_id: 'seminar-1' });
  });

  it('maps a student registration with its server-derived status and seminar', async () => {
    const registrations = query({
      data: [{
        id: 'registration-1',
        seminar_id: 'seminar-1',
        student_user_id: 'user-1',
        reference: 'TKT-1',
        status: 'confirmed',
        registered_at: '2026-11-01T10:00:00.000Z',
        confirmed_at: '2026-11-01T10:05:00.000Z',
        attendance_ack_at: null,
        time_in_at: null,
        time_out_at: null,
      }],
      error: null,
    });
    const seminars = query({ data: [seminarRow()], error: null });
    const client = makeClient({ registration_read_model: registrations, seminars });
    mocked.getSupabaseClient.mockReturnValue(client);

    const result = await listMySeminars({ pageSize: 10 });

    expect(result).toMatchObject({
      ok: true,
      data: { items: [{ seminar: { id: 'seminar-1' }, registration: { reference: 'TKT-1', status: 'confirmed', confirmedAt: '2026-11-01T10:05:00.000Z' } }] },
    });
  });

  it('filters finished history in the database query before applying the cursor limit', async () => {
    mocked.getServerTime.mockResolvedValue({ ok: true, data: { now: '2026-11-09T10:00:00.000Z' } });
    const registrations = query({ data: [{
      id: 'registration-1', seminar_id: 'seminar-1', student_user_id: 'user-1', reference: 'TKT-1',
      status: 'confirmed', registered_at: '2026-11-01T10:00:00.000Z', confirmed_at: '2026-11-01T10:05:00.000Z',
      attendance_ack_at: null, time_in_at: null, time_out_at: null, seminar_ends_at: '2026-10-31T10:00:00.000Z',
    }], error: null });
    const seminars = query({ data: [seminarRow({ ends_at: '2026-10-31T10:00:00.000Z' })], error: null });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ registration_read_model: registrations, seminars }));

    const result = await listHistory({ pageSize: 10 });

    expect(registrations.calls.lte?.[0]?.[0]).toBe('seminar_ends_at');
    expect(result).toMatchObject({ ok: true, data: { items: [{ seminar: { id: 'seminar-1' } }] } });
  });

  it('uses the same organization search fields as the listing UI and mock', async () => {
    const seminars = query({ data: [], error: null });
    const drafts = query({ data: [], error: null });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ seminars, seminar_drafts: drafts }));

    await listOrgSeminars({
      seminars: { search: 'Speaker', pageSize: 10 },
      drafts: { search: 'Speaker', pageSize: 10 },
    });

    expect(seminars.calls.or).toContainEqual(['title.ilike."%Speaker%",speaker_name.ilike."%Speaker%",venue.ilike."%Speaker%",reference.ilike."%Speaker%",department.ilike."%Speaker%"']);
    expect(drafts.calls.is).toContainEqual(['published_seminar_id', null]);
    expect(drafts.calls.or).toContainEqual(['details->>title.ilike."%Speaker%",details->>speakerName.ilike."%Speaker%",details->>venue.ilike."%Speaker%",details->>department.ilike."%Speaker%"']);
  });

  it('returns an organization access error from row-level security', async () => {
    const seminars = query({ data: null, error: { code: '42501', message: 'permission denied' } });
    const drafts = query({ data: [], error: null });
    mocked.getSupabaseClient.mockReturnValue(makeClient({ seminars, seminar_drafts: drafts }));

    await expect(listOrgSeminars()).resolves.toEqual({ ok: false, error: { code: 'forbidden' } });
  });

  it('creates an edit draft through the organization-scoped RPC and preserves its private webinar URL', async () => {
    const draft = {
      id: 'draft-1',
      organization_id: 'org-1',
      editing_seminar_id: 'seminar-1',
      created_by: 'user-1',
      details: { seminarType: 'webinar', joinUrl: 'https://meet.example.test/private' },
      certificate_template: { backgroundUrl: 'private/template.png' },
      survey_definition: { sections: [] },
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: '2026-11-01T10:00:00.000Z',
    };
    const client = makeClient({}, { data: draft, error: null });
    mocked.getSupabaseClient.mockReturnValue(client);

    const result = await createOrgEditDraft('seminar-1');

    expect(client.rpc).toHaveBeenCalledWith('create_org_edit_draft', { p_seminar_id: 'seminar-1' });
    expect(result).toMatchObject({ ok: true, data: { editingSeminarId: 'seminar-1', details: { joinUrl: 'https://meet.example.test/private' }, certificate: { backgroundUrl: 'private/template.png' } } });
  });
});
