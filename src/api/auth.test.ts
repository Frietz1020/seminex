import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionIdentity } from './types';

const mocked = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getSupabaseMode: vi.fn(),
}));

vi.mock('./supabaseClient', () => mocked);

import {
  completeOrganizationSignup,
  completeStudentSignup,
  getCurrentIdentity,
  getOrgIdentity,
  getProfile,
  orgSignIn,
  resetPassword,
  sendPasswordResetOtp,
  sendSignupOtp,
  signIn,
  submitOrgAccessRequest,
  withdrawOrgAccessRequest,
  verifyPasswordResetOtp,
  verifySignupOtp,
} from './auth';

type QueryResult = { data: unknown; error: null | { message: string; code?: string } };

interface FakeQuery {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (result: QueryResult) => unknown) => Promise<unknown>;
}

function query(data: unknown = [], error: QueryResult['error'] = null): FakeQuery {
  const result = { data, error };
  const builder = {} as FakeQuery;
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.insert = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve) => Promise.resolve(resolve(result));
  return builder;
}

function makeClient() {
  const profile = query({
    id: 'user-1',
    email: '209999901@gordoncollege.edu.ph',
    student_id: '209999901',
    first_name: 'Test',
    last_name: 'Student',
    middle_initial: '',
    program: 'CS',
    year_level: 2,
    block: 'A',
    display_name: 'Test Student',
  });
  const memberships = query([
    { organization_id: 'org-1', role: 'org_member', status: 'active' },
    { organization_id: 'org-2', role: 'adviser', status: 'active' },
    { organization_id: 'org-3', role: 'org_member', status: 'removed' },
  ]);
  const requests = query(null);
  const organizations = query({ id: 'org-1', name: 'CCS Student Council', department: 'CCS' });
  const auth = {
    signInWithPassword: vi.fn(async () => ({ data: { user, session }, error: null })),
    signUp: vi.fn(async () => ({ data: { user, session: null }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: { user, session }, error: null })),
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user }, error: null })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const client = {
    auth,
    from: vi.fn((table: string) => table === 'profiles' ? profile : table === 'organization_memberships' ? memberships : table === 'organizations' ? organizations : requests),
    rpc: vi.fn(async () => ({ data: {}, error: null })),
  };
  return { client, auth, profile, memberships, requests, organizations };
}

const user = { id: 'user-1', email: '209999901@gordoncollege.edu.ph' };
const session = { expires_at: 1_800_000_000, access_token: 'private-access-token', refresh_token: 'private-refresh-token' };

describe('Supabase Auth adapter', () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = makeClient();
    mocked.getSupabaseMode.mockReturnValue('supabase');
    mocked.getSupabaseClient.mockReturnValue(harness.client);
  });

  it('signs in with the institutional email and returns safe identity without tokens', async () => {
    const result = await signIn({ studentId: '209999901', password: 'not-persisted' });

    expect(harness.auth.signInWithPassword).toHaveBeenCalledWith({
      email: '209999901@gordoncollege.edu.ph',
      password: 'not-persisted',
    });
    expect(harness.auth.verifyOtp).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      data: {
        studentId: '209999901',
        expiresAt: 1_800_000_000_000,
        role: 'adviser',
        organizationIds: ['org-1', 'org-2'],
        onboardingComplete: true,
      } satisfies SessionIdentity,
    });
    expect(JSON.stringify(result)).not.toContain('private-access-token');
  });

  it('returns a generic invalid-credentials result without exposing Auth details', async () => {
    harness.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never);

    const result = await signIn({ studentId: '209999901', password: 'not-persisted' });

    expect(result).toEqual({ ok: false, error: { code: 'invalid_credentials' } });
    expect(JSON.stringify(result)).not.toContain('Invalid login credentials');
  });

  it('loads the authorized organization identity from Supabase rows', async () => {
    harness.memberships.then = (resolve) => Promise.resolve(resolve({ data: [
      { organization_id: 'org-1', role: 'org_member', status: 'active' },
    ], error: null }));
    harness.memberships.maybeSingle.mockResolvedValue({ data: {
      id: 'membership-1', organization_id: 'org-1', user_id: 'user-1', role: 'org_member', status: 'active',
      created_at: '2026-08-01T00:00:00.000Z',
      position: 'Secretary', appointed_at: '2026-09-01T00:00:00.000Z', endorsed_by: 'adviser-current',
    }, error: null });
    harness.requests.maybeSingle.mockResolvedValue({ data: {
      organization_id: 'org-1', position: 'President', decided_by: 'adviser-old',
      requested_at: '2026-08-01T00:00:00.000Z', status: 'approved',
    }, error: null });

    const result = await getOrgIdentity();

    expect(result).toMatchObject({
      ok: true,
      data: {
        role: 'org_member',
        accountId: 'user-1',
        firstName: 'Test',
        lastName: 'Student',
        position: 'Secretary',
        organization: { id: 'org-1', name: 'CCS Student Council', department: 'CCS', adviserId: 'adviser-current' },
        membership: {
          id: 'membership-1',
          position: 'Secretary',
          status: 'active',
          appointedAt: '2026-09-01T00:00:00.000Z',
          endorsedByAdviserId: 'adviser-current',
        },
        adviser: { id: 'adviser-current' },
      },
    });
    expect(harness.client.from).toHaveBeenCalledWith('organization_memberships');
  });

  it('sends a signup OTP by creating a pending Auth user with the supplied password', async () => {
    const result = await sendSignupOtp('209999901', 'signup-password');

    expect(result).toEqual({ ok: true, data: undefined });
    expect(harness.auth.signUp).toHaveBeenCalledWith({
      email: '209999901@gordoncollege.edu.ph',
      password: 'signup-password',
      options: { data: { student_id: '209999901' } },
    });
  });

  it('verifies signup codes with the signup OTP type', async () => {
    await verifySignupOtp('209999901', '123456');

    expect(harness.auth.verifyOtp).toHaveBeenCalledWith({
      email: '209999901@gordoncollege.edu.ph',
      token: '123456',
      type: 'signup',
    });
  });

  it('completes student signup without trying to reset the password already set at signup', async () => {
    const result = await completeStudentSignup({
      studentId: '209999901',
      password: 'signup-password',
      firstName: 'Test',
      lastName: 'Student',
      middleInitial: '',
      program: 'CS',
      yearLevel: 2,
      block: 'A',
    });

    expect(harness.profile.update).toHaveBeenCalledWith({
      first_name: 'Test',
      last_name: 'Student',
      middle_initial: '',
      program: 'CS',
      year_level: 2,
      block: 'A',
      display_name: 'Test Student',
    });
    expect(harness.auth.updateUser).not.toHaveBeenCalled();
    expect(harness.auth.signOut).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: { email: '209999901@gordoncollege.edu.ph' } });
  });

  it('completes organization signup without trying to reset the password already set at signup', async () => {
    const result = await completeOrganizationSignup(
      {
        studentId: '209999901',
        password: 'signup-password',
        firstName: 'Test',
        lastName: 'Student',
        middleInitial: '',
        program: 'CS',
        yearLevel: 2,
        block: 'A',
      },
      { organizationId: 'org-1', position: 'Officer', statement: 'Apply' },
    );

    expect(harness.client.rpc).toHaveBeenCalledWith('complete_org_signup', {
      p_first_name: 'Test',
      p_last_name: 'Student',
      p_middle_initial: '',
      p_program: 'CS',
      p_year_level: 2,
      p_block: 'A',
      p_organization_id: 'org-1',
      p_position: 'Officer',
      p_statement: 'Apply',
    });
    expect(harness.auth.updateUser).not.toHaveBeenCalled();
    expect(harness.auth.signOut).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: { email: '209999901@gordoncollege.edu.ph' } });
  });

  it('sends password recovery email to the derived address', async () => {
    await sendPasswordResetOtp('209999901');
    expect(harness.auth.resetPasswordForEmail).toHaveBeenCalledWith('209999901@gordoncollege.edu.ph');
  });

  it('verifies recovery codes with the recovery OTP type', async () => {
    await verifyPasswordResetOtp('209999901', '654321');
    expect(harness.auth.verifyOtp).toHaveBeenCalledWith({
      email: '209999901@gordoncollege.edu.ph',
      token: '654321',
      type: 'recovery',
    });
  });

  it('updates the password after recovery verification and signs out', async () => {
    const result = await resetPassword('209999901', 'new-password');
    expect(harness.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(harness.auth.signOut).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('returns configuration_error when backend settings are incomplete', async () => {
    mocked.getSupabaseMode.mockReturnValue('misconfigured');
    const result = await signIn({ studentId: '209999901', password: 'password' });
    expect(result).toEqual({ ok: false, error: { code: 'configuration_error' } });
    expect(harness.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('maps unknown Auth failures to a generic error', async () => {
    harness.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: { message: 'internal database failure' } } as never);
    const result = await signIn({ studentId: '209999901', password: 'password' });
    expect(result).toEqual({ ok: false, error: { code: 'network' } });
    expect(JSON.stringify(result)).not.toContain('internal database failure');
  });

  it('returns a pending org access state without granting a role from metadata', async () => {
    harness.memberships.then = (resolve) => Promise.resolve(resolve({ data: [], error: null }));
    harness.requests.maybeSingle.mockResolvedValue({ data: { status: 'pending' }, error: null });
    const result = await orgSignIn({ identifier: '209999901', password: 'password' });
    expect(result).toEqual({ ok: true, data: { access: 'pending' } });
  });

  it('returns safe identity for a current user using active memberships only', async () => {
    const result = await getCurrentIdentity();
    expect(result).toMatchObject({ ok: true, data: { role: 'adviser', organizationIds: ['org-1', 'org-2'] } });
    expect(JSON.stringify(result)).not.toContain('private-refresh-token');
  });

  it('marks a verified account with missing profile fields as incomplete', async () => {
    harness.memberships.then = (resolve) => Promise.resolve(resolve({ data: [], error: null }));
    harness.profile.maybeSingle.mockResolvedValue({
      data: {
        student_id: '209999901',
        email: '209999901@gordoncollege.edu.ph',
        first_name: null,
        last_name: null,
        program: null,
        year_level: null,
        block: null,
      },
      error: null,
    });

    const result = await getCurrentIdentity();

    expect(result).toMatchObject({ ok: true, data: { onboardingComplete: false } });
  });

  it('reads profile fields without inventing college or enrollment status', async () => {
    const result = await getProfile();

    expect(result).toMatchObject({
      ok: true,
      data: {
        studentId: '209999901',
        firstName: 'Test',
        lastName: 'Student',
        program: 'CS',
        yearLevel: 2,
        block: 'A',
        college: null,
        enrollmentStatus: null,
        unreadNotificationCount: 0,
      },
    });
  });

  it('submits an organization access request for the authenticated participant', async () => {
    harness.memberships.then = (resolve) => Promise.resolve(resolve({ data: [], error: null }));
    harness.requests.single.mockResolvedValue({
      data: {
        id: 'request-1',
        organization_id: 'org-1',
        position: 'Officer',
        statement: 'Apply',
        requested_at: '2026-11-06T00:00:00.000Z',
        status: 'pending',
      },
      error: null,
    });

    const result = await submitOrgAccessRequest({
      organizationId: 'org-1',
      position: 'Officer',
      statement: 'Apply',
      fullName: 'Test Student',
    });

    expect(harness.requests.insert).toHaveBeenCalledWith({
      organization_id: 'org-1',
      user_id: 'user-1',
      position: 'Officer',
      statement: 'Apply',
    });
    expect(result).toMatchObject({ ok: true, data: { id: 'request-1', studentId: '209999901', status: 'pending' } });
  });

  it('withdraws only the authenticated participant’s pending organization request', async () => {
    harness.memberships.then = (resolve) => Promise.resolve(resolve({ data: [], error: null }));
    harness.requests.then = (resolve) => Promise.resolve(resolve({ data: [{ id: 'request-1' }], error: null }));

    const result = await withdrawOrgAccessRequest();

    expect(harness.requests.delete).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
