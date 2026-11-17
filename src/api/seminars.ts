import { getSessionIdentity } from '../session/storage';
import { getSupabaseClient } from './supabaseClient';
import { getServerTime } from './serverTime';
import type { AuthoredSurvey, OrgSeminar, OrgSeminarListingPage, OrgSeminarListingRequest, SeminarDraft, SeminarDetailsDraft } from './orgTypes';
import type { ApiErrorCode, ApiResult, CursorPage, CursorPageRequest, Registration, Seminar, SeminarListItem, Ticket } from './types';

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };
type DbResult = { data: unknown; error: DbError | null };

const SEMINAR_COLUMNS = [
  'id', 'organization_id', 'reference', 'title', 'description', 'overview', 'objectives',
  'seminar_type', 'speaker_name', 'speaker_role', 'venue', 'venue_guidelines', 'department',
  'topics', 'starts_at', 'ends_at', 'capacity', 'registered_count', 'required_attendance_percent',
  'confirmation_opens_hours_before', 'confirmation_closes_hours_before', 'image_url',
  'curriculum_credit', 'organizing_body', 'certificate_eligibility', 'publication_status', 'published_at',
].join(', ');
const REGISTRATION_COLUMNS = [
  'id', 'seminar_id', 'student_user_id', 'reference', 'status', 'registered_at', 'confirmed_at',
  'attendance_ack_at', 'time_in_at', 'time_out_at',
  'seminar_ends_at', 'evaluation_submitted_at',
].join(', ');
const DEFAULT_PAGE_SIZE = 50;
const MAX_API_ROWS = 1000;
const SEMINAR_COVER_BUCKET = 'seminar-covers';
const MAX_SEMINAR_COVER_BYTES = 5 * 1024 * 1024;
const SEMINAR_COVER_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(row: Row, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function nullableString(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function seminarFromRow(value: unknown): Seminar | null {
  if (!isRow(value) || typeof value.id !== 'string' || typeof value.starts_at !== 'string' || typeof value.ends_at !== 'string') return null;
  const seminar: Seminar = {
    id: value.id,
    reference: stringValue(value, 'reference'),
    title: stringValue(value, 'title'),
    description: stringValue(value, 'description'),
    speaker: {
      name: stringValue(value, 'speaker_name'),
      role: stringValue(value, 'speaker_role'),
    },
    venue: stringValue(value, 'venue'),
    department: stringValue(value, 'department'),
    topics: stringArray(value.topics),
    startsAt: value.starts_at,
    endsAt: value.ends_at,
    capacity: numberValue(value, 'capacity', 1),
    registeredCount: numberValue(value, 'registered_count'),
    requiredAttendancePercent: numberValue(value, 'required_attendance_percent', 60),
    seminarType: value.seminar_type === 'webinar' ? 'webinar' : 'seminar',
    confirmationOpensHoursBefore: numberValue(value, 'confirmation_opens_hours_before', 24),
    confirmationClosesHoursBefore: numberValue(value, 'confirmation_closes_hours_before', 1),
  };
  const overview = nullableString(value, 'overview');
  const venueGuidelines = nullableString(value, 'venue_guidelines');
  const imageUrl = nullableString(value, 'image_url');
  const curriculumCredit = nullableString(value, 'curriculum_credit');
  const organizingBody = nullableString(value, 'organizing_body');
  const certificateEligibility = nullableString(value, 'certificate_eligibility');
  if (overview) seminar.overview = overview;
  if (venueGuidelines) seminar.venueGuidelines = venueGuidelines;
  if (imageUrl) seminar.imageUrl = imageUrl;
  if (curriculumCredit) seminar.curriculumCredit = curriculumCredit;
  if (organizingBody) seminar.organizingBody = organizingBody;
  if (certificateEligibility) seminar.certificateEligibility = certificateEligibility;
  if (Array.isArray(value.objectives)) seminar.objectives = stringArray(value.objectives);
  return seminar;
}

function registrationFromRow(value: unknown): Registration | null {
  if (!isRow(value) || typeof value.reference !== 'string' || typeof value.registered_at !== 'string') return null;
  const status = value.status;
  if (status !== 'registered' && status !== 'confirmed' && status !== 'released' && status !== 'cancelled') return null;
  const timeInAt = nullableString(value, 'time_in_at');
  const timeOutAt = nullableString(value, 'time_out_at');
  return {
    reference: value.reference,
    registeredAt: value.registered_at,
    status,
    confirmedAt: nullableString(value, 'confirmed_at') ?? null,
    attendanceAckAt: nullableString(value, 'attendance_ack_at') ?? null,
    timeIn: timeInAt ? { at: timeInAt } : null,
    timeOut: timeOutAt ? { at: timeOutAt, validated: true } : null,
    evaluationSubmittedAt: nullableString(value, 'evaluation_submitted_at') ?? null,
    certificateIssuedAt: null,
  };
}

function seminarItem(row: unknown, registration: unknown = null): SeminarListItem | null {
  const seminar = seminarFromRow(row);
  if (!seminar) return null;
  return { seminar, registration: registration === null ? null : registrationFromRow(registration) };
}

function apiError(error: DbError): ApiErrorCode {
  const message = error.message.toLowerCase();
  const known: ApiErrorCode[] = [
    'seminar_full', 'not_available', 'forbidden', 'not_found', 'validation_failed',
    'conflict', 'rate_limited', 'invalid_credentials', 'session_expired', 'student_id_taken',
  ];
  const match = known.find((code) => message.includes(code));
  if (match) return match;
  if (error.code === '23505') return 'conflict';
  if (error.code === '23514' || error.code === '22P02') return 'validation_failed';
  if (error.code === '42501') return 'forbidden';
  if (error.code === 'PGRST116') return 'not_found';
  if (error.code?.startsWith('08')) return 'network';
  // Returned PostgREST errors confirm the request was rejected. Reserve network
  // for transport failures (caught in settle) and connection-class SQLSTATEs.
  return 'validation_failed';
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

function errorResult<T>(error: DbError): ApiResult<T> {
  return failure(apiError(error));
}

async function settle<T>(request: PromiseLike<DbResult>, map: (data: unknown) => T): Promise<ApiResult<T>> {
  try {
    const result = await request;
    if (result.error) return errorResult(result.error);
    return { ok: true, data: map(result.data) };
  } catch {
    return failure('network');
  }
}

interface Cursor {
  key: string;
  id: string;
}

function encodeCursor(key: string, id: string): string {
  return encodeURIComponent(JSON.stringify({ key, id } satisfies Cursor));
}

function decodeCursor(cursor: string | undefined): Cursor | null | false {
  if (!cursor) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(cursor));
    if (!isRow(value) || typeof value.key !== 'string' || !Number.isFinite(Date.parse(value.key)) || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id)) return false;
    return { key: value.key, id: value.id };
  } catch {
    return false;
  }
}

function pageSize(request?: CursorPageRequest): number | null {
  if (request?.pageSize !== undefined && (!Number.isInteger(request.pageSize) || request.pageSize < 1)) return null;
  return Math.min(request?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_API_ROWS - 1);
}

function pageRows<T extends Row>(rows: unknown, size: number, key: keyof T): CursorPage<T> | null {
  if (!Array.isArray(rows) || rows.some((row) => !isRow(row))) return null;
  const page = rows as T[];
  const hasMore = page.length > size;
  const items = hasMore ? page.slice(0, size) : page;
  const last = items.at(-1);
  const nextKey = last?.[key];
  const nextId = last?.id;
  if (hasMore && (typeof nextKey !== 'string' || typeof nextId !== 'string')) return null;
  return {
    items,
    nextCursor: hasMore && typeof nextKey === 'string' && typeof nextId === 'string' ? encodeCursor(nextKey, nextId) : null,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function searchFilter(fields: string[], value: string): string {
  const pattern = `%${escapeLike(value).replaceAll('"', '\\"')}%`;
  return fields.map((field) => `${field}.ilike."${pattern}"`).join(',');
}

async function currentUserId(): Promise<ApiResult<string | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const result = await supabase.auth.getUser();
    if (result.error) return result.error.code ? errorResult(result.error) : failure('network');
    return { ok: true, data: result.data.user?.id ?? null };
  } catch {
    return failure('network');
  }
}

async function registrationsForSeminars(ids: string[]): Promise<ApiResult<Map<string, Row>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  if (ids.length === 0) return { ok: true, data: new Map() };
  const user = await currentUserId();
  if (!user.ok) return user;
  if (!user.data) return { ok: true, data: new Map() };
  const result = await settle(
    supabase.from('registration_read_model').select(REGISTRATION_COLUMNS).in('seminar_id', ids),
    (data) => data,
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.data) || result.data.some((row) => !isRow(row))) return failure('validation_failed');
  return { ok: true, data: new Map((result.data as Row[]).map((row) => [stringValue(row, 'seminar_id'), row])) };
}

export async function listAvailableSeminars(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const size = pageSize(request);
  if (size === null) return failure('validation_failed');
  const cursor = decodeCursor(request?.cursor);
  if (cursor === false) return failure('validation_failed');
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    let query = supabase.from('seminars').select(SEMINAR_COLUMNS).eq('publication_status', 'published');
    const search = request?.search?.trim();
    if (search) query = query.ilike('title', `%${escapeLike(search)}%`);
    if (cursor) query = query.or(`starts_at.gt.${cursor.key},and(starts_at.eq.${cursor.key},id.gt.${cursor.id})`);
    query = query.order('starts_at', { ascending: true }).order('id', { ascending: true }).limit(size + 1);
    const result = await settle(query, (data) => data);
    if (!result.ok) return result;
    const page = pageRows<Row>(result.data, size, 'starts_at');
    if (!page || page.items.some((row) => typeof row.id !== 'string')) return failure('validation_failed');
    const registrations = await registrationsForSeminars(page.items.map((row) => stringValue(row, 'id')));
    if (!registrations.ok) return registrations;
    const items = page.items.map((row) => seminarItem(row, registrations.data.get(stringValue(row, 'id')) ?? null));
    if (items.some((item) => item === null)) return failure('validation_failed');
    return { ok: true, data: { items: items as SeminarListItem[], nextCursor: page.nextCursor } };
  } catch {
    return failure('network');
  }
}

async function listStudentSeminars(request?: CursorPageRequest, finishedBefore?: string): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const size = pageSize(request);
  if (size === null) return failure('validation_failed');
  const cursor = decodeCursor(request?.cursor);
  if (cursor === false) return failure('validation_failed');
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const user = await currentUserId();
  if (!user.ok) return user;
  if (!user.data) return failure('session_expired');
  try {
    let query = supabase.from('registration_read_model').select(REGISTRATION_COLUMNS).neq('status', 'cancelled');
    if (finishedBefore) query = query.lte('seminar_ends_at', finishedBefore);
    if (cursor) query = query.or(`registered_at.lt.${cursor.key},and(registered_at.eq.${cursor.key},id.lt.${cursor.id})`);
    query = query.order('registered_at', { ascending: false }).order('id', { ascending: false }).limit(size + 1);
    const result = await settle(query, (data) => data);
    if (!result.ok) return result;
    const registrationPage = pageRows<Row>(result.data, size, 'registered_at');
    if (!registrationPage || registrationPage.items.some((row) => typeof row.seminar_id !== 'string')) return failure('validation_failed');
    const seminarIds = [...new Set(registrationPage.items.map((row) => stringValue(row, 'seminar_id')))];
    if (seminarIds.length === 0) return { ok: true, data: { items: [], nextCursor: null } };
    const seminarResult = await settle(supabase.from('seminars').select(SEMINAR_COLUMNS).in('id', seminarIds), (data) => data);
    if (!seminarResult.ok) return seminarResult;
    if (!Array.isArray(seminarResult.data) || seminarResult.data.some((row) => !isRow(row))) return failure('validation_failed');
    const seminarMap = new Map((seminarResult.data as Row[]).map((row) => [stringValue(row, 'id'), row]));
    const items = registrationPage.items.map((registration) => seminarItem(
      seminarMap.get(stringValue(registration, 'seminar_id')),
      registration,
    ));
    if (items.some((item) => item === null)) return failure('validation_failed');
    return { ok: true, data: { items: items as SeminarListItem[], nextCursor: registrationPage.nextCursor } };
  } catch {
    return failure('network');
  }
}

export async function listMySeminars(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  return listStudentSeminars(request);
}

export async function listHistory(request?: CursorPageRequest): Promise<ApiResult<CursorPage<SeminarListItem>>> {
  const serverTime = await getServerTime();
  if (!serverTime.ok) return failure(serverTime.error.code);
  const timestamp = Date.parse(serverTime.data.now);
  if (!Number.isFinite(timestamp)) return failure('network');
  const cutoff = new Date(timestamp - 60 * 60_000).toISOString();
  return listStudentSeminars(request, cutoff);
}

export async function getSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const seminarResult = await settle(supabase.from('seminars').select(SEMINAR_COLUMNS).eq('id', seminarId).maybeSingle(), (data) => data);
    if (!seminarResult.ok) return seminarResult;
    if (!isRow(seminarResult.data)) return failure('not_found');
    const user = await currentUserId();
    if (!user.ok) return user;
    let registrationRow: Row | null = null;
    if (user.data) {
      const registrationResult = await settle(
        supabase.from('registration_read_model').select(REGISTRATION_COLUMNS).eq('seminar_id', seminarId).maybeSingle(),
        (data) => data,
      );
      if (!registrationResult.ok) return registrationResult;
      registrationRow = isRow(registrationResult.data) ? registrationResult.data : null;
    }
    const item = seminarItem(seminarResult.data, registrationRow);
    if (!item) return failure('validation_failed');
    if (item.seminar.seminarType === 'webinar' && item.registration?.status === 'confirmed') {
      const link = await settle(supabase.rpc('get_webinar_join_url', { p_seminar_id: seminarId }), (data) => data);
      if (link.ok && typeof link.data === 'string') item.seminar.joinUrl = link.data;
      else if (!link.ok && link.error.code !== 'not_available') return link;
    }
    return { ok: true, data: item };
  } catch {
    return failure('network');
  }
}

export async function getTicket(seminarId: string): Promise<ApiResult<Ticket>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const user = await currentUserId();
    if (!user.ok) return user;
    if (!user.data) return failure('session_expired');

    const registration = await settle(
      supabase.from('registration_read_model')
        .select('seminar_id,student_user_id,status,registered_at')
        .eq('seminar_id', seminarId)
        .eq('student_user_id', user.data)
        .maybeSingle(),
      (data) => data,
    );
    if (!registration.ok) return registration;
    if (!isRow(registration.data)
      || registration.data.seminar_id !== seminarId
      || registration.data.student_user_id !== user.data
      || (registration.data.status !== 'registered' && registration.data.status !== 'confirmed')
      || typeof registration.data.registered_at !== 'string') return failure('not_found');

    const profile = await settle(
      supabase.from('profiles').select('student_id').eq('id', user.data).maybeSingle(),
      (data) => data,
    );
    if (!profile.ok) return profile;
    if (!isRow(profile.data) || typeof profile.data.student_id !== 'string' || !profile.data.student_id) {
      return failure('not_found');
    }

    return { ok: true, data: {
      seminarId,
      studentId: profile.data.student_id,
      issuedAt: registration.data.registered_at,
    } };
  } catch {
    return failure('network');
  }
}

export async function registerForSeminar(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const result = await settle(supabase.rpc('register_for_seminar', { p_seminar_id: seminarId }), (data) => data);
  if (!result.ok) return result;
  return getSeminar(seminarId);
}

export async function cancelRegistration(seminarId: string): Promise<ApiResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  return settle(supabase.rpc('cancel_registration', { p_seminar_id: seminarId }), () => undefined);
}

export async function confirmRegistration(seminarId: string): Promise<ApiResult<SeminarListItem>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const result = await settle(supabase.rpc('confirm_registration', { p_seminar_id: seminarId }), (data) => data);
  return result.ok ? getSeminar(seminarId) : result;
}

function draftFromRow(value: unknown): SeminarDraft | null {
  if (!isRow(value) || typeof value.id !== 'string' || typeof value.organization_id !== 'string' || typeof value.created_at !== 'string' || typeof value.updated_at !== 'string') return null;
  const details = isRow(value.details) ? value.details as SeminarDetailsDraft : {};
  const certificate = isRow(value.certificate_template) ? value.certificate_template as unknown as SeminarDraft['certificate'] : null;
  const survey = isRow(value.survey_definition) ? value.survey_definition as unknown as AuthoredSurvey : null;
  const draft: SeminarDraft = {
    id: value.id,
    organizationId: value.organization_id,
    createdByOfficerId: stringValue(value, 'created_by'),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    details,
    certificate,
    survey,
  };
  const editingSeminarId = nullableString(value, 'editing_seminar_id');
  if (editingSeminarId) draft.editingSeminarId = editingSeminarId;
  return draft;
}

function seminarToOrgSeminar(value: unknown): OrgSeminar | null {
  const seminar = seminarFromRow(value);
  if (!seminar || !isRow(value)) return null;
  return {
    ...seminar,
    organizationId: stringValue(value, 'organization_id'),
    registrationClosed: false,
    endedEarlyAt: null,
    cancellation: null,
  };
}

function parsePageRequest(request: CursorPageRequest | undefined): { size: number; cursor: Cursor | null } | false {
  const size = pageSize(request);
  const cursor = decodeCursor(request?.cursor);
  if (size === null || cursor === false) return false;
  return { size, cursor };
}

export async function listOrgSeminars(request?: OrgSeminarListingRequest): Promise<ApiResult<OrgSeminarListingPage>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const seminarRequest = parsePageRequest(request?.seminars);
  const draftRequest = parsePageRequest(request?.drafts);
  if (seminarRequest === false || draftRequest === false) return failure('validation_failed');
  try {
    let seminarQuery = supabase.from('seminars').select(SEMINAR_COLUMNS).neq('publication_status', 'draft');
    const seminarSearch = request?.seminars?.search?.trim();
    if (seminarSearch) seminarQuery = seminarQuery.or(searchFilter(['title', 'speaker_name', 'venue', 'reference', 'department'], seminarSearch));
    if (seminarRequest.cursor) {
      const { key, id } = seminarRequest.cursor;
      seminarQuery = seminarQuery.or(`starts_at.lt.${key},and(starts_at.eq.${key},id.lt.${id})`);
    }
    seminarQuery = seminarQuery.order('starts_at', { ascending: false }).order('id', { ascending: false }).limit(seminarRequest.size + 1);

    let draftQuery = supabase.from('seminar_drafts').select('*').is('published_seminar_id', null);
    const draftSearch = request?.drafts?.search?.trim();
    if (draftSearch) draftQuery = draftQuery.or(searchFilter(['details->>title', 'details->>speakerName', 'details->>venue', 'details->>department'], draftSearch));
    if (draftRequest.cursor) {
      const { key, id } = draftRequest.cursor;
      draftQuery = draftQuery.or(`updated_at.lt.${key},and(updated_at.eq.${key},id.lt.${id})`);
    }
    draftQuery = draftQuery.order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(draftRequest.size + 1);

    const [seminarsResult, draftsResult] = await Promise.all([
      settle(seminarQuery, (data) => data),
      settle(draftQuery, (data) => data),
    ]);
    if (!seminarsResult.ok) return seminarsResult;
    if (!draftsResult.ok) return draftsResult;
    const seminarPage = pageRows<Row>(seminarsResult.data, seminarRequest.size, 'starts_at');
    const draftPage = pageRows<Row>(draftsResult.data, draftRequest.size, 'updated_at');
    if (!seminarPage || !draftPage) return failure('validation_failed');
    const seminars = seminarPage.items.map(seminarToOrgSeminar);
    const drafts = draftPage.items.map(draftFromRow);
    if (seminars.some((item) => item === null) || drafts.some((item) => item === null)) return failure('validation_failed');
    return {
      ok: true,
      data: {
        seminars: { items: seminars as OrgSeminar[], nextCursor: seminarPage.nextCursor },
        drafts: { items: drafts as SeminarDraft[], nextCursor: draftPage.nextCursor },
      },
    };
  } catch {
    return failure('network');
  }
}

export async function createOrgDraft(): Promise<ApiResult<SeminarDraft>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const organizationId = getSessionIdentity()?.organizationIds[0];
  if (!organizationId) return failure('forbidden');
  const surveyId = crypto.randomUUID();
  const survey: AuthoredSurvey = {
    id: surveyId,
    version: 1,
    seminarId: surveyId,
    title: 'Seminar evaluation',
    instructions: '',
    sections: [],
  };
  return settle(
    supabase.from('seminar_drafts').insert({ organization_id: organizationId, details: {}, certificate_template: null, survey_definition: survey }).select('*').single(),
    (data) => draftFromRow(data) ?? (() => { throw new Error('Invalid seminar draft response'); })(),
  );
}

export async function createOrgEditDraft(seminarId: string): Promise<ApiResult<SeminarDraft>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  return settle(
    supabase.rpc('create_org_edit_draft', { p_seminar_id: seminarId }),
    (data) => draftFromRow(data) ?? (() => { throw new Error('Invalid seminar draft response'); })(),
  );
}

async function coverDraftOrganization(draftId: string): Promise<ApiResult<string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const draft = await settle(
    supabase.from('seminar_drafts').select('organization_id').eq('id', draftId).is('published_seminar_id', null).maybeSingle(),
    (data) => isRow(data) && typeof data.organization_id === 'string' ? data.organization_id : null,
  );
  if (!draft.ok) return draft;
  return draft.data ? { ok: true, data: draft.data } : failure('not_found');
}

export async function uploadOrgSeminarCover(
  draftId: string,
  file: File,
): Promise<ApiResult<{ publicUrl: string; objectPath: string }>> {
  const extension = SEMINAR_COVER_EXTENSIONS[file.type as keyof typeof SEMINAR_COVER_EXTENSIONS];
  if (!extension || file.size < 1 || file.size > MAX_SEMINAR_COVER_BYTES) return failure('validation_failed');
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const draft = await coverDraftOrganization(draftId);
  if (!draft.ok) return draft;

  const objectPath = `${draft.data}/${draftId}/${crypto.randomUUID()}.${extension}`;
  const storage = supabase.storage.from(SEMINAR_COVER_BUCKET);
  const uploaded = await settle(
    storage.upload(objectPath, file, { contentType: file.type, upsert: false }),
    () => undefined,
  );
  if (!uploaded.ok) return uploaded;

  try {
    const publicUrl = storage.getPublicUrl(objectPath).data.publicUrl;
    if (!publicUrl) {
      await storage.remove([objectPath]);
      return failure('network');
    }
    return { ok: true, data: { publicUrl, objectPath } };
  } catch {
    try { await storage.remove([objectPath]); } catch { /* Preserve upload failure result. */ }
    return failure('network');
  }
}

export async function removeOrgSeminarCover(draftId: string, objectPath: string): Promise<ApiResult<void>> {
  const draft = await coverDraftOrganization(draftId);
  if (!draft.ok) return draft;
  const prefix = `${draft.data}/${draftId}/`;
  if (!objectPath.startsWith(prefix)) return failure('forbidden');
  const filename = objectPath.slice(prefix.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i.test(filename)) return failure('validation_failed');
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  return settle(supabase.storage.from(SEMINAR_COVER_BUCKET).remove([objectPath]), () => undefined);
}

export async function saveOrgDraft(draft: SeminarDraft): Promise<ApiResult<SeminarDraft>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  return settle(
    supabase.from('seminar_drafts').update({
      editing_seminar_id: draft.editingSeminarId ?? null,
      details: draft.details,
      certificate_template: draft.certificate,
      survey_definition: draft.survey,
    }).eq('id', draft.id).is('published_seminar_id', null).select('*').maybeSingle(),
    (data) => draftFromRow(data) ?? (() => { throw new Error('Draft not found'); })(),
  );
}

export async function publishOrgDraft(draftId: string): Promise<ApiResult<OrgSeminar>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  return settle(
    supabase.rpc('publish_seminar', { p_draft_id: draftId }),
    (data) => seminarToOrgSeminar(data) ?? (() => { throw new Error('Invalid published seminar response'); })(),
  );
}
