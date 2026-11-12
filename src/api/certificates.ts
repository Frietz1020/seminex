import { getSupabaseClient } from './supabaseClient';
import type { ApiErrorCode, ApiResult } from './types';
import type { CertificateRecord, CertificateTemplate, OrgSeminarCertificateData } from './orgTypes';

type Row = Record<string, unknown>;
type DbError = { code?: string; message?: string };

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiError(error: DbError): ApiErrorCode {
  const message = (error.message ?? '').toLowerCase();
  const known: ApiErrorCode[] = ['validation_failed', 'conflict', 'rate_limited', 'not_available', 'not_found', 'forbidden', 'session_expired', 'network'];
  const match = known.find((code) => message.includes(code));
  if (match) return match;
  if (error.code === '42501') return 'forbidden';
  if (error.code === 'PGRST116') return 'not_found';
  return 'network';
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

async function functionErrorCode(error: { message?: string; context?: unknown }): Promise<ApiErrorCode> {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body: unknown = await context.clone().json();
      if (isRow(body) && typeof body.code === 'string') return apiError({ message: body.code });
    } catch {
      // Keep the generic network classification when the Edge Function response is not JSON.
    }
  }
  return apiError({ message: error.message });
}

async function downloadPdf(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, objectPath: string): Promise<ApiResult<Blob>> {
  const { data, error } = await supabase.storage.from('certificates').createSignedUrl(objectPath, 60);
  if (error) return failure(apiError(error));
  const signedUrl = data?.signedUrl;
  if (typeof signedUrl !== 'string') return failure('network');
  try {
    const response = await fetch(signedUrl, { cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/pdf')) return failure('network');
    const blob = await response.blob();
    return blob.size > 0 ? { ok: true, data: blob } : failure('network');
  } catch {
    return failure('network');
  }
}

export async function getCertificate(seminarId: string): Promise<ApiResult<Blob>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { error: issueError } = await supabase.functions.invoke('issue-certificate', { body: { seminarId } });
    if (issueError) return failure(await functionErrorCode(issueError));

    const { data, error } = await supabase.rpc('get_my_certificate', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!isRow(data) || data.status !== 'issued' || typeof data.object_path !== 'string') return failure('not_available');
    return await downloadPdf(supabase, data.object_path);
  } catch {
    return failure('network');
  }
}

function certificateTemplate(value: unknown): CertificateTemplate | null {
  if (!isRow(value) || typeof value.backgroundUrl !== 'string' || !isRow(value.nameBox)
    || typeof value.updatedAt !== 'string') return null;
  const box = value.nameBox;
  if (![box.x, box.y, box.width, box.height, box.fontSize].every((part) => typeof part === 'number' && Number.isFinite(part))
    || typeof box.fontFamily !== 'string' || (box.fontWeight !== 400 && box.fontWeight !== 700)
    || !['left', 'center', 'right'].includes(String(box.align)) || typeof box.color !== 'string') return null;
  return value as unknown as CertificateTemplate;
}

function certificateRecord(value: unknown): CertificateRecord | null {
  if (!isRow(value) || typeof value.id !== 'string' || typeof value.seminarId !== 'string'
    || typeof value.studentId !== 'string' || !['waiting', 'blocked', 'issued'].includes(String(value.state))
    || typeof value.reason !== 'string'
    || (value.issuedAt !== null && value.issuedAt !== undefined && typeof value.issuedAt !== 'string')
    || (value.serial !== null && value.serial !== undefined && typeof value.serial !== 'string')) return null;
  return {
    id: value.id,
    seminarId: value.seminarId,
    studentId: value.studentId,
    state: value.state as CertificateRecord['state'],
    reason: value.reason,
    ...(typeof value.issuedAt === 'string' ? { issuedAt: value.issuedAt } : {}),
    ...(typeof value.serial === 'string' ? { serial: value.serial } : {}),
  };
}

export async function getOrgSeminarCertificates(seminarId: string): Promise<ApiResult<OrgSeminarCertificateData>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase.rpc('get_org_seminar_certificates', { p_seminar_id: seminarId });
    if (error) return failure(apiError(error));
    if (!isRow(data) || !Array.isArray(data.records)) return failure('network');
    const template = data.template === null ? null : certificateTemplate(data.template);
    const records = data.records.map(certificateRecord);
    if ((data.template !== null && template === null) || records.some((record) => record === null)) return failure('network');
    return { ok: true, data: { template, records: records as CertificateRecord[], overrideRequests: [] } };
  } catch {
    return failure('network');
  }
}

export async function getOrgCertificate(seminarId: string, registrationId: string): Promise<ApiResult<Blob>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = await supabase
      .from('certificate_issuances')
      .select('status, object_path')
      .eq('seminar_id', seminarId)
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error) return failure(apiError(error));
    if (!isRow(data) || data.status !== 'issued' || typeof data.object_path !== 'string') return failure('not_found');
    return await downloadPdf(supabase, data.object_path);
  } catch {
    return failure('network');
  }
}
