import { getSupabaseClient } from './supabaseClient';
import type { ApiErrorCode, ApiResult, AttendanceProof, AttendanceScanChallenge, ProofKind } from './types';
import type { OrgRegistration, RecordOrgChallengeScanInput, RecordOrgScanInput, RecordOrgScanResult, ScanLedgerEntry } from './orgTypes';

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullableString(row: Row, key: string): string | undefined {
  return typeof row[key] === 'string' && row[key] ? row[key] as string : undefined;
}

function apiError(error: DbError): ApiErrorCode {
  const message = error.message.toLowerCase();
  const codes: ApiErrorCode[] = ['validation_failed', 'conflict', 'rate_limited', 'not_available', 'not_found', 'forbidden', 'session_expired', 'network'];
  return codes.find((code) => message.includes(code)) ?? (error.code === '42501' ? 'forbidden' : 'network');
}

async function functionErrorCode(error: { message: string; context?: unknown }): Promise<ApiErrorCode> {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (isRow(body) && typeof body.code === 'string') return apiError({ message: body.code });
    } catch {
      return apiError(error);
    }
  }
  return apiError(error);
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

function program(value: unknown): OrgRegistration['program'] {
  return value === 'CS' || value === 'IT' || value === 'EMC' ? value : null;
}

function yearLevel(value: unknown): OrgRegistration['yearLevel'] {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

function block(value: unknown): OrgRegistration['block'] {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E' || value === 'F' ? value : null;
}

function rosterFromRow(row: Row): OrgRegistration | null {
  if (typeof row.id !== 'string' || typeof row.seminar_id !== 'string' || typeof row.student_id !== 'string') return null;
  const registration: OrgRegistration = {
    id: row.id,
    seminarId: row.seminar_id,
    studentId: row.student_id,
    firstName: stringValue(row, 'first_name'),
    lastName: stringValue(row, 'last_name'),
    middleInitial: stringValue(row, 'middle_initial'),
    program: program(row.program),
    yearLevel: yearLevel(row.year_level),
    block: block(row.block),
    email: stringValue(row, 'email'),
    registeredAt: stringValue(row, 'registered_at'),
    status: row.status === 'confirmed' || row.status === 'released' || row.status === 'cancelled' ? row.status : 'registered',
    confirmedAt: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
    attendanceAckAt: typeof row.attendance_ack_at === 'string' ? row.attendance_ack_at : null,
    removal: null,
  };
  const avatarUrl = nullableString(row, 'avatar_url');
  if (avatarUrl) registration.avatarUrl = avatarUrl;
  return registration;
}

function ledgerFromRow(row: Row): ScanLedgerEntry | null {
  if (typeof row.id !== 'string' || typeof row.seminar_id !== 'string' || typeof row.student_id !== 'string'
    || typeof row.event_at !== 'string' || typeof row.officer_id !== 'string') return null;
  const kind = row.kind;
  const method = row.method;
  if ((kind !== 'time_in' && kind !== 'time_out' && kind !== 'correction')
    || (method !== 'qr' && method !== 'manual' && method !== 'webinar_proof' && method !== 'correction')) return null;
  const entry: ScanLedgerEntry = {
    id: row.id,
    seminarId: row.seminar_id,
    studentId: row.student_id,
    kind,
    at: row.event_at,
    method,
    officerId: row.officer_id,
    officerName: stringValue(row, 'officer_name'),
  };
  const reason = nullableString(row, 'reason');
  const correctsEntryId = nullableString(row, 'corrects_entry_id');
  if (reason) entry.reason = reason;
  if (correctsEntryId) entry.correctsEntryId = correctsEntryId;
  return entry;
}

function proofFromRow(row: Row, imageUrl: string): AttendanceProof | null {
  if (typeof row.id !== 'string' || typeof row.seminar_id !== 'string' || typeof row.student_id !== 'string'
    || (row.kind !== 'time_in' && row.kind !== 'time_out') || typeof row.submitted_at !== 'string'
    || (row.status !== 'pending' && row.status !== 'approved' && row.status !== 'rejected')) return null;
  const proof: AttendanceProof = { id: row.id, seminarId: row.seminar_id, studentId: row.student_id, kind: row.kind, imageUrl, submittedAt: row.submitted_at, status: row.status };
  const reviewedAt = nullableString(row, 'reviewed_at');
  const reviewedBy = nullableString(row, 'reviewed_by');
  const rejectionReason = nullableString(row, 'rejection_reason');
  if (reviewedAt) proof.reviewedAt = reviewedAt;
  if (reviewedBy) proof.reviewedBy = reviewedBy;
  if (rejectionReason) proof.rejectionReason = rejectionReason;
  return proof;
}

async function signProofRows(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, values: unknown[]): Promise<ApiResult<AttendanceProof[]>> {
  const rows = values.filter(isRow);
  if (rows.length !== values.length) return failure('network');
  if (rows.length === 0) return { ok: true, data: [] };
  const paths = rows.map((row) => stringValue(row, 'object_path'));
  if (paths.some((path) => !path)) return failure('network');
  const { data: signed, error } = await supabase.storage.from('webinar-proofs').createSignedUrls(paths, 60 * 60);
  if (error) return failure(apiError(error));
  const signedByPath = new Map((signed ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const proofs: AttendanceProof[] = [];
  for (const row of rows) {
    const proof = proofFromRow(row, signedByPath.get(stringValue(row, 'object_path')) ?? '');
    if (!proof) return failure('network');
    proofs.push(proof);
  }
  return { ok: true, data: proofs };
}

export async function listOrgRoster(seminarId: string): Promise<ApiResult<OrgRegistration[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('list_org_roster', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!Array.isArray(data)) return failure('network');
    const rawRows = data.filter(isRow);
    const avatarPaths = [...new Set(rawRows.map((row) => nullableString(row, 'avatar_url')).filter((path): path is string => Boolean(path)))];
    const signedByPath = new Map<string, string>();
    if (avatarPaths.length) {
      const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrls(avatarPaths, 60 * 60);
      if (signedError) return failure(apiError(signedError));
      for (const item of signed ?? []) if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
    const rows = rawRows.map((row) => rosterFromRow({ ...row, avatar_url: row.avatar_url ? signedByPath.get(String(row.avatar_url)) : undefined }));
    if (rows.some((item) => item === null)) return failure('network');
    return { ok: true, data: rows as OrgRegistration[] };
  } catch {
    return failure('network');
  }
}

export async function listLedger(seminarId: string): Promise<ApiResult<ScanLedgerEntry[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('list_attendance_ledger', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!Array.isArray(data)) return failure('network');
    const rows = data.filter(isRow).map(ledgerFromRow);
    if (rows.some((item) => item === null)) return failure('network');
    return { ok: true, data: rows as ScanLedgerEntry[] };
  } catch {
    return failure('network');
  }
}

function identityFromRow(value: unknown): RecordOrgScanResult['student'] | null {
  if (!isRow(value) || typeof value.studentId !== 'string') return null;
  const names = stringValue(value, 'fullName').trim().split(/\s+/).filter(Boolean);
  const student: RecordOrgScanResult['student'] = {
    studentId: value.studentId,
    firstName: stringValue(value, 'firstName') || names.slice(0, -1).join(' '),
    lastName: stringValue(value, 'lastName') || names.at(-1) || '',
    middleInitial: stringValue(value, 'middleInitial'),
    program: program(value.program),
    yearLevel: yearLevel(value.yearLevel),
    block: block(value.block),
  };
  const avatarUrl = nullableString(value, 'avatarUrl');
  if (avatarUrl) student.avatarUrl = avatarUrl;
  return student;
}

export async function recordOrgScan(input: RecordOrgScanInput): Promise<ApiResult<RecordOrgScanResult>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('record_org_scan', {
      p_seminar_id: input.seminarId,
      p_student_id: input.studentId,
      p_method: input.method,
      p_reason: input.reason?.trim() ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) return failure(apiError(error));
    if (!isRow(data) || !isRow(data.entry) || !isRow(data.student)) return failure('network');
    const entryRow = data.entry;
    const entry = ledgerFromRow({
      ...entryRow,
      student_id: input.studentId,
      officer_id: entryRow.officer_user_id,
      officer_name: entryRow.officer_name ?? '',
    });
    const student = identityFromRow(data.student);
    if (!entry || !student) return failure('network');
    if (student.avatarUrl) {
      const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(student.avatarUrl, 60 * 60);
      if (signedError || !signed?.signedUrl) return failure('network');
      student.avatarUrl = signed.signedUrl;
    }
    return { ok: true, data: { entry, student } };
  } catch {
    return failure('network');
  }
}

export async function issueAttendanceChallenge(seminarId: string): Promise<ApiResult<AttendanceScanChallenge>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('issue_attendance_challenge', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!isRow(data) || !/^[a-f0-9]{64}$/.test(stringValue(data, 'challenge')) || !stringValue(data, 'expires_at')) return failure('network');
    return { ok: true, data: { challenge: stringValue(data, 'challenge'), expiresAt: stringValue(data, 'expires_at') } };
  } catch {
    return failure('network');
  }
}

export async function recordOrgChallengeScan(input: RecordOrgChallengeScanInput): Promise<ApiResult<RecordOrgScanResult>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  if (!/^[a-f0-9]{64}$/.test(input.challenge)) return failure('validation_failed');
  try {
    const { data, error } = await supabase.rpc('record_org_challenge_scan', {
      p_seminar_id: input.seminarId,
      p_challenge: input.challenge,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) return failure(apiError(error));
    if (!isRow(data) || !isRow(data.entry) || !isRow(data.student)) return failure('network');
    const studentId = stringValue(data.student, 'studentId');
    const entry = ledgerFromRow({ ...data.entry, student_id: studentId, officer_id: data.entry.officer_user_id, officer_name: data.entry.officer_name ?? '' });
    const student = identityFromRow(data.student);
    if (!entry || !student) return failure('network');
    if (student.avatarUrl) {
      const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(student.avatarUrl, 3600);
      if (signedError || !signed?.signedUrl) return failure('network');
      student.avatarUrl = signed.signedUrl;
    }
    return { ok: true, data: { entry, student } };
  } catch {
    return failure('network');
  }
}

export async function uploadWebinarProof(seminarId: string, kind: ProofKind, file: File): Promise<ApiResult<AttendanceProof>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  const form = new FormData();
  form.set('seminarId', seminarId);
  form.set('kind', kind);
  form.set('idempotencyKey', crypto.randomUUID());
  form.set('file', file, file.name);
  try {
    const { data, error } = await supabase.functions.invoke('upload-webinar-proof', { body: form });
    if (error) return failure(await functionErrorCode(error));
    if (!isRow(data) || !isRow(data.proof)) return failure('network');
    const proofRow = data.proof;
    const path = stringValue(proofRow, 'object_path');
    const { data: signed, error: signedError } = await supabase.storage.from('webinar-proofs').createSignedUrl(path, 60 * 60);
    if (signedError || !signed?.signedUrl) return failure('network');
    const proof = proofFromRow(proofRow, signed.signedUrl);
    return proof ? { ok: true, data: proof } : failure('network');
  } catch {
    return failure('network');
  }
}

export async function listWebinarProofs(seminarId: string): Promise<ApiResult<AttendanceProof[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('list_webinar_proofs', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!Array.isArray(data)) return failure('network');
    return signProofRows(supabase, data);
  } catch {
    return failure('network');
  }
}

export async function listMyWebinarProofs(seminarId: string): Promise<ApiResult<AttendanceProof[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.from('webinar_proofs').select('*').eq('seminar_id', seminarId).order('submitted_at');
    if (error) return failure(apiError(error));
    if (!Array.isArray(data)) return failure('network');
    return signProofRows(supabase, data);
  } catch {
    return failure('network');
  }
}

/** Records the signed-in student's attendance acknowledgement through the database policy boundary. */
export async function acknowledgeAttendance(seminarId: string): Promise<ApiResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { error } = await supabase.rpc('acknowledge_attendance', { p_seminar_id: seminarId });
    return error ? failure(apiError(error)) : { ok: true, data: undefined };
  } catch {
    return failure('network');
  }
}

export async function reviewWebinarProof(proofId: string, approve: boolean, reason?: string): Promise<ApiResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { error } = await supabase.rpc('review_webinar_proof', { p_proof_id: proofId, p_approve: approve, p_reason: reason?.trim() ?? null });
    return error ? failure(apiError(error)) : { ok: true, data: undefined };
  } catch {
    return failure('network');
  }
}
