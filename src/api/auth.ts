import type {
  Adviser,
  OrgAccessStatusResult,
  OrgIdentity,
  OrgRequest,
  OrgSignInInput,
  OrgSignInResult,
  OrgSignUpInput,
  Organization,
} from './orgTypes';
import type {
  ApiErrorCode,
  ApiResult,
  AvatarResult,
  EditableProfile,
  Profile,
  Program,
  SessionIdentity,
  SignInInput,
  SignUpInput,
  SignUpResult,
} from './types';
import { STUDENT_EMAIL_DOMAIN } from '../config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseMode } from './supabaseClient';

interface AuthError {
  code?: string;
  message?: string;
  status?: number;
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

function mapError<T>(error: AuthError): ApiResult<T> {
  const code = error.code?.toLowerCase() ?? '';
  if (error.status === 429 || code.includes('rate_limit') || code.includes('over_email_send')) return failure('rate_limited');
  if (code === 'user_already_exists' || code === 'email_exists') return failure('student_id_taken');
  if (code.includes('invalid_credentials') || code.includes('invalid_grant') || code.includes('otp_expired') || code.includes('token_not_found')) {
    return failure('invalid_credentials');
  }
  if (code === 'not_authenticated' || code === 'session_not_found' || code === 'session_expired') return failure('session_expired');
  if (code === 'forbidden' || code === '42501') return failure('forbidden');
  if (code === '23505') return failure('conflict');
  return failure('network');
}

function clientOrError(): SupabaseClient | ApiResult<never> {
  if (getSupabaseMode() !== 'supabase') return failure('configuration_error');
  const client = getSupabaseClient();
  return client ?? failure('configuration_error');
}

function isApiFailure(value: SupabaseClient | ApiResult<never>): value is ApiResult<never> {
  return 'ok' in value;
}

function emailForStudentId(studentId: string): string {
  return `${studentId.trim()}@${STUDENT_EMAIL_DOMAIN}`.toLowerCase();
}

function toSafeIdentity(
  profile: {
    student_id: string | null;
    email: string;
    first_name: string | null;
    last_name: string | null;
    program: string | null;
    year_level: number | null;
    block: string | null;
  },
  memberships: Array<{ organization_id: string; role: 'org_member' | 'adviser'; status: string }>,
  expiresAt: number,
): SessionIdentity {
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  const role = activeMemberships.some((membership) => membership.role === 'adviser')
    ? 'adviser'
    : activeMemberships.some((membership) => membership.role === 'org_member')
      ? 'org_member'
      : 'participant';
  return {
    studentId: profile.student_id ?? profile.email,
    expiresAt,
    role,
    organizationIds: [...new Set(activeMemberships.map((membership) => membership.organization_id))],
    onboardingComplete: role === 'adviser' || Boolean(
      profile.first_name?.trim() && profile.last_name?.trim() && profile.program &&
      profile.year_level && profile.block,
    ),
  };
}

/** Returns only the authenticated identity and active membership-derived roles. */
export async function getCurrentIdentity(): Promise<ApiResult<SessionIdentity | null>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return { ok: true, data: null };

  const [{ data: sessionData, error: sessionError }, { data: profile, error: profileError }, { data: memberships, error: membershipsError }] = await Promise.all([
    client.auth.getSession(),
    client.from('profiles').select('student_id,email,first_name,last_name,program,year_level,block').eq('id', userData.user.id).maybeSingle(),
    client.from('organization_memberships').select('organization_id,role,status').eq('user_id', userData.user.id),
  ]);
  if (sessionError) return mapError(sessionError);
  if (profileError) return mapError(profileError);
  if (membershipsError) return mapError(membershipsError);
  if (!profile) return failure('not_available');
  const expiresAt = sessionData.session?.expires_at;
  if (!expiresAt) return failure('session_expired');

  return {
    ok: true,
    data: toSafeIdentity(profile, memberships ?? [], expiresAt * 1000),
  };
}

/** Loads the active organization workspace from caller-scoped Supabase rows. */
export async function getOrgIdentity(): Promise<ApiResult<OrgIdentity>> {
  const identity = await getCurrentIdentity();
  if (!identity.ok) return identity;
  if (!identity.data) return failure('session_expired');
  if (identity.data.role === 'participant') return failure('forbidden');
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  const userId = userData.user?.id;
  if (!userId) return failure('session_expired');
  const organizationId = identity.data.organizationIds[0];
  if (!organizationId) return failure('forbidden');

  const [profileResult, membershipResult, organizationResult] = await Promise.all([
    client.from('profiles').select('id,email,student_id,first_name,last_name,display_name').eq('id', userId).maybeSingle(),
    client.from('organization_memberships').select('id,organization_id,user_id,role,status,created_at,position,appointed_at,endorsed_by').eq('organization_id', organizationId).eq('user_id', userId).eq('status', 'active').maybeSingle(),
    client.from('organizations').select('id,name,department').eq('id', organizationId).maybeSingle(),
  ]);
  if (profileResult.error) return mapError(profileResult.error);
  if (membershipResult.error) return mapError(membershipResult.error);
  if (organizationResult.error) return mapError(organizationResult.error);
  const profile = profileResult.data;
  const membershipRow = membershipResult.data;
  const organizationRow = organizationResult.data;
  if (!profile || !membershipRow || !organizationRow) return failure('forbidden');
  const names = (profile.first_name && profile.last_name
    ? [profile.first_name, profile.last_name]
    : String(profile.display_name ?? profile.email.split('@')[0]).split(/\s+/));
  const firstName = names[0] ?? '';
  const lastName = names.slice(1).join(' ');
  const adviserId = membershipRow.role === 'adviser' ? userId : membershipRow.endorsed_by ?? '';
  const adviser: Adviser = {
    id: adviserId,
    email: membershipRow.role === 'adviser' ? profile.email : '',
    firstName: membershipRow.role === 'adviser' ? firstName : '',
    lastName: membershipRow.role === 'adviser' ? lastName : '',
    title: 'Faculty adviser',
    organizationIds: [organizationId],
  };
  const organization = {
    id: organizationRow.id,
    name: organizationRow.name,
    department: organizationRow.department,
    adviserId,
  };
  if (membershipRow.role === 'adviser') {
    return {
      ok: true,
      data: {
        role: 'adviser', accountId: userId, firstName, lastName, email: profile.email,
        position: 'Faculty adviser', organization, adviser,
      },
    };
  }
  return {
    ok: true,
    data: {
      role: 'org_member', accountId: userId, firstName, lastName,
      studentId: profile.student_id ?? identity.data.studentId,
      email: profile.email,
      position: membershipRow.position,
      organization,
      membership: {
        id: membershipRow.id,
        organizationId,
        studentId: profile.student_id ?? identity.data.studentId,
        position: membershipRow.position,
        status: 'active',
        appointedAt: membershipRow.appointed_at,
        endorsedByAdviserId: adviserId,
      },
      adviser,
    },
  };
}

async function signInWithEmail(email: string, password: string): Promise<ApiResult<SessionIdentity>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return mapError(error);
  const identity = await getCurrentIdentity();
  if (!identity.ok) return identity;
  return identity.data ? { ok: true, data: identity.data } : failure('session_expired');
}

export async function signIn(input: SignInInput): Promise<ApiResult<SessionIdentity>> {
  return signInWithEmail(emailForStudentId(input.studentId), input.password);
}

/** Creates the pending password account and sends the signup OTP before profile completion. */
export async function sendSignupOtp(studentId: string, password: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.signUp({
    email: emailForStudentId(studentId),
    password,
    options: { data: { student_id: studentId.trim() } },
  });
  return error ? mapError(error) : { ok: true, data: undefined };
}

export async function verifySignupOtp(studentId: string, code: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.verifyOtp({
    email: emailForStudentId(studentId),
    token: code,
    type: 'signup',
  });
  return error ? mapError(error) : { ok: true, data: undefined };
}

export async function resendSignupOtp(email: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.resend({ type: 'signup', email: email.toLowerCase() });
  return error ? mapError(error) : { ok: true, data: undefined };
}

async function authenticatedUserId(studentId: string): Promise<ApiResult<{ id: string; email: string }>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { data, error } = await client.auth.getUser();
  if (error) return mapError(error);
  if (!data.user) return failure('session_expired');
  if (!data.user.email || data.user.email.toLowerCase() !== emailForStudentId(studentId)) return failure('forbidden');
  return { ok: true, data: { id: data.user.id, email: data.user.email } };
}

function profileUpdate(input: Pick<SignUpInput, 'firstName' | 'lastName' | 'middleInitial' | 'program' | 'yearLevel' | 'block'>) {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    middle_initial: input.middleInitial.trim(),
    program: input.program,
    year_level: input.yearLevel,
    block: input.block,
    display_name: `${input.firstName.trim()} ${input.lastName.trim()}`,
  };
}

export async function completeStudentSignup(input: SignUpInput): Promise<ApiResult<SignUpResult>> {
  const identity = await authenticatedUserId(input.studentId);
  if (!identity.ok) return identity;
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { error } = await client.from('profiles').update(profileUpdate(input)).eq('id', identity.data.id);
  if (error) return mapError(error);
  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) return mapError(signOutError);
  return { ok: true, data: { email: identity.data.email } };
}

export async function completeOrganizationSignup(
  input: SignUpInput,
  organization: { organizationId: string; position: string; statement?: string },
): Promise<ApiResult<SignUpResult>> {
  const identity = await authenticatedUserId(input.studentId);
  if (!identity.ok) return identity;
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { error } = await client.rpc('complete_org_signup', {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_middle_initial: input.middleInitial.trim(),
    p_program: input.program,
    p_year_level: input.yearLevel,
    p_block: input.block,
    p_organization_id: organization.organizationId,
    p_position: organization.position.trim(),
    p_statement: organization.statement?.trim() || null,
  });
  if (error) return mapError(error);
  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) return mapError(signOutError);
  return { ok: true, data: { email: identity.data.email } };
}

export async function orgSignIn(input: OrgSignInInput): Promise<ApiResult<OrgSignInResult>> {
  const identifier = input.identifier.trim();
  const email = identifier.includes('@') ? identifier.toLowerCase() : emailForStudentId(identifier);
  const signedIn = await signInWithEmail(email, input.password);
  if (!signedIn.ok) return signedIn;
  if (signedIn.data.role === 'adviser') return { ok: true, data: { access: 'adviser' } };
  if (signedIn.data.role === 'org_member') return { ok: true, data: { access: 'organization' } };

  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const { data: request, error } = await client
    .from('organization_access_requests')
    .select('status')
    .eq('user_id', userData.user.id)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return mapError(error);
  if (request?.status === 'pending') return { ok: true, data: { access: 'pending' } };
  if (request?.status === 'rejected') return { ok: true, data: { access: 'rejected' } };
  return { ok: true, data: { access: 'none' } };
}

export async function listOrganizations(): Promise<ApiResult<Organization[]>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { data, error } = await client.from('organizations').select('id,name,department').order('name');
  if (error) return mapError(error);
  return {
    ok: true,
    data: (data ?? []).map((organization) => ({
      id: organization.id,
      name: organization.name,
      department: organization.department,
      adviserId: '',
    })),
  };
}

/** Reads the signed-in participant's profile fields without assuming registrar-owned values. */
export async function getProfile(): Promise<ApiResult<Profile>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const { data: profile, error } = await client
    .from('profiles')
    .select('student_id,email,first_name,last_name,middle_initial,program,year_level,block,avatar_url')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) return mapError(error);
  if (!profile || !profile.first_name || !profile.last_name || !profile.program || !profile.year_level || !profile.block) {
    return failure('not_available');
  }
  let avatarUrl: string | undefined;
  if (profile.avatar_url) {
    const { data: signed, error: signedError } = await client.storage.from('avatars').createSignedUrl(profile.avatar_url, 60 * 60);
    if (signedError) return mapError(signedError);
    avatarUrl = signed.signedUrl;
  }
  return {
    ok: true,
    data: {
      studentId: profile.student_id ?? profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      middleInitial: profile.middle_initial ?? '',
      program: profile.program as Program,
      yearLevel: profile.year_level as Profile['yearLevel'],
      block: profile.block as Profile['block'],
      ...(avatarUrl ? { avatarUrl } : {}),
      college: null,
      enrollmentStatus: null,
      unreadNotificationCount: 0,
    },
  };
}

/** Stores a private avatar object and sets its path through the authenticated database function. */
export async function uploadAvatar(file: File): Promise<ApiResult<AvatarResult>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) return failure('validation_failed');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  const user = userData.user;
  if (!user) return failure('session_expired');
  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from('avatars').upload(objectPath, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) return mapError(uploadError);
  const { data: oldObjectPath, error: profileError } = await client.rpc('set_my_avatar', { p_object_path: objectPath });
  if (profileError) {
    await client.storage.from('avatars').remove([objectPath]);
    return mapError(profileError);
  }
  if (typeof oldObjectPath === 'string' && oldObjectPath !== objectPath) {
    await client.storage.from('avatars').remove([oldObjectPath]);
  }
  const { data: signed, error: signedError } = await client.storage.from('avatars').createSignedUrl(objectPath, 60 * 60);
  if (signedError) return mapError(signedError);
  return { ok: true, data: { avatarUrl: signed.signedUrl } };
}

/** Updates only editable identity fields through the caller's RLS-protected profile row. */
export async function updateProfile(input: EditableProfile): Promise<ApiResult<Profile>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const { error } = await client.from('profiles').update(profileUpdate(input)).eq('id', userData.user.id);
  if (error) return mapError(error);
  return getProfile();
}

/** Creates the access request for the authenticated participant; role and identity come from Auth and RLS. */
export async function submitOrgAccessRequest(
  input: OrgSignUpInput & { fullName: string },
): Promise<ApiResult<OrgRequest>> {
  const identity = await getCurrentIdentity();
  if (!identity.ok) return identity;
  if (!identity.data) return failure('session_expired');
  if (identity.data.role === 'adviser') return failure('forbidden');
  if (identity.data.onboardingComplete === false) return failure('not_available');
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const profile = await getProfile();
  if (!profile.ok) return profile;
  const { data, error } = await client
    .from('organization_access_requests')
    .insert({
      organization_id: input.organizationId,
      user_id: userData.user.id,
      position: input.position.trim(),
      statement: input.statement?.trim() || null,
    })
    .select('id,organization_id,position,statement,status,requested_at')
    .single();
  if (error) return mapError(error);
  return {
    ok: true,
    data: {
      id: data.id,
      studentId: identity.data.studentId,
      fullName: `${profile.data.firstName} ${profile.data.lastName}`,
      organizationId: data.organization_id,
      position: data.position,
      statement: data.statement ?? undefined,
      requestedAt: data.requested_at,
      status: data.status,
    },
  };
}

/** Reads the current participant's latest organization request under the request table's RLS policy. */
export async function getMyOrgAccessStatus(): Promise<ApiResult<OrgAccessStatusResult>> {
  const identity = await getCurrentIdentity();
  if (!identity.ok) return identity;
  if (!identity.data) return failure('session_expired');
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const { data: row, error } = await client
    .from('organization_access_requests')
    .select('id,organization_id,position,statement,status,requested_at,decided_at,decision_note')
    .eq('user_id', userData.user.id)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return mapError(error);
  if (!row) return { ok: true, data: { status: 'none', request: null, organization: null, membership: null, adviser: null } };
  const organizations = await listOrganizations();
  if (!organizations.ok) return organizations;
  const organization = organizations.data.find((entry) => entry.id === row.organization_id) ?? null;
  const profile = await getProfile();
  if (!profile.ok) return profile;
  return {
    ok: true,
    data: {
      status: row.status,
      request: {
        id: row.id,
        studentId: identity.data.studentId,
        fullName: `${profile.data.firstName} ${profile.data.lastName}`,
        organizationId: row.organization_id,
        position: row.position,
        statement: row.statement ?? undefined,
        requestedAt: row.requested_at,
        status: row.status,
        decidedAt: row.decided_at ?? undefined,
        decisionNote: row.decision_note ?? undefined,
      },
      organization,
      membership: null,
      adviser: null,
    },
  };
}

/** Deletes only the signed-in participant's pending request; Row Level Security enforces ownership. */
export async function withdrawOrgAccessRequest(): Promise<ApiResult<void>> {
  const identity = await getCurrentIdentity();
  if (!identity.ok) return identity;
  if (!identity.data) return failure('session_expired');
  if (identity.data.role === 'adviser') return failure('forbidden');
  const client = getSupabaseClient();
  if (!client) return failure('configuration_error');
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) return mapError(userError);
  if (!userData.user) return failure('session_expired');
  const { data, error } = await client
    .from('organization_access_requests')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('status', 'pending')
    .select('id');
  if (error) return mapError(error);
  if (!data?.length) return failure('not_found');
  return { ok: true, data: undefined };
}

export async function sendPasswordResetOtp(studentId: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.resetPasswordForEmail(emailForStudentId(studentId));
  return error ? mapError(error) : { ok: true, data: undefined };
}

export async function verifyPasswordResetOtp(studentId: string, code: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.verifyOtp({
    email: emailForStudentId(studentId),
    token: code,
    type: 'recovery',
  });
  return error ? mapError(error) : { ok: true, data: undefined };
}

export async function resetPassword(_studentId: string, password: string): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.updateUser({ password });
  if (error) return mapError(error);
  const { error: signOutError } = await client.auth.signOut();
  return signOutError ? mapError(signOutError) : { ok: true, data: undefined };
}

export async function signOut(): Promise<ApiResult<void>> {
  const client = clientOrError();
  if (isApiFailure(client)) return client;
  const { error } = await client.auth.signOut();
  return error ? mapError(error) : { ok: true, data: undefined };
}
