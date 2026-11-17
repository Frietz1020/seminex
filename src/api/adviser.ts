import { getSupabaseClient } from './supabaseClient';
import type { ApiErrorCode, ApiResult } from './types';
import type { AdviserDirectoryMember, OrgRequest } from './orgTypes';

type Row = Record<string, unknown>;
type DbError = { code?: string; message?: string };

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(row: Row, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function optionalString(row: Row, key: string): string | undefined | null {
  if (row[key] === undefined || row[key] === null) return undefined;
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function requestFromRow(value: unknown): OrgRequest | null {
  if (!isRow(value)) return null;
  const id = requiredString(value, 'id');
  const studentId = requiredString(value, 'studentId');
  const fullName = requiredString(value, 'fullName');
  const organizationId = requiredString(value, 'organizationId');
  const position = requiredString(value, 'position');
  const requestedAt = requiredString(value, 'requestedAt');
  const statement = optionalString(value, 'statement');
  const decidedAt = optionalString(value, 'decidedAt');
  const decidedByAdviserId = optionalString(value, 'decidedByAdviserId');
  const decisionNote = optionalString(value, 'decisionNote');
  if (!id || !studentId || fullName === null || !organizationId || !position || !requestedAt
    || statement === null || decidedAt === null || decidedByAdviserId === null || decisionNote === null
    || (value.status !== 'pending' && value.status !== 'approved' && value.status !== 'rejected')) return null;

  const request: OrgRequest = {
    id,
    studentId,
    fullName,
    organizationId,
    position,
    requestedAt,
    status: value.status,
  };
  if (statement !== undefined) request.statement = statement;
  if (decidedAt !== undefined) request.decidedAt = decidedAt;
  if (decidedByAdviserId !== undefined) request.decidedByAdviserId = decidedByAdviserId;
  if (decisionNote !== undefined) request.decisionNote = decisionNote;
  return request;
}

function directoryMemberFromRow(value: unknown): AdviserDirectoryMember | null {
  if (!isRow(value)) return null;
  const id = requiredString(value, 'id');
  const organizationId = requiredString(value, 'organizationId');
  const fullName = requiredString(value, 'fullName');
  const email = requiredString(value, 'email');
  const studentId = optionalString(value, 'studentId');
  const position = requiredString(value, 'position');
  const appointedAt = requiredString(value, 'appointedAt');
  if (!id || !organizationId || fullName === null || email === null || studentId === null
    || !position || appointedAt === null || (value.status !== 'active' && value.status !== 'removed')
    || (value.category !== 'member' && value.category !== 'adviser')) return null;

  const member: AdviserDirectoryMember = {
    id,
    organizationId,
    fullName,
    email,
    position,
    status: value.status,
    appointedAt,
    category: value.category,
  };
  if (studentId !== undefined) member.studentId = studentId;
  return member;
}

function apiError(error: DbError): ApiErrorCode {
  const message = error.message?.toLowerCase() ?? '';
  const stableCodes: ApiErrorCode[] = ['validation_failed', 'conflict', 'not_found', 'forbidden'];
  return stableCodes.find((code) => message.includes(code)) ?? (error.code === '42501' ? 'forbidden' : 'network');
}

function failure<T>(code: ApiErrorCode): ApiResult<T> {
  return { ok: false, error: { code } };
}

function listFromRows<T>(value: unknown, fromRow: (row: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(fromRow);
  return rows.some((row) => row === null) ? null : rows as T[];
}

async function invoke<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  fromValue: (value: unknown) => T | null,
): Promise<ApiResult<T>> {
  const supabase = getSupabaseClient();
  if (!supabase) return failure('configuration_error');
  try {
    const { data, error } = args === undefined
      ? await supabase.rpc(name)
      : await supabase.rpc(name, args);
    if (error) return failure(apiError(error));
    const mapped = fromValue(data);
    return mapped === null ? failure('network') : { ok: true, data: mapped };
  } catch {
    return failure('network');
  }
}

export function listAdviserOrgRequests(): Promise<ApiResult<OrgRequest[]>> {
  return invoke('list_adviser_org_requests', undefined, (value) => listFromRows(value, requestFromRow));
}

export function listAdviserOrgMembers(): Promise<ApiResult<AdviserDirectoryMember[]>> {
  return invoke('list_adviser_org_members', undefined, (value) => listFromRows(value, directoryMemberFromRow));
}

export function decideAdviserOrgRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  decisionNote?: string,
): Promise<ApiResult<OrgRequest>> {
  return invoke('decide_adviser_org_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_decision_note: decisionNote?.trim() || null,
  }, requestFromRow);
}

export function updateAdviserMemberPosition(memberId: string, position: string): Promise<ApiResult<AdviserDirectoryMember>> {
  return invoke('update_adviser_member_position', {
    p_membership_id: memberId,
    p_position: position.trim(),
  }, directoryMemberFromRow);
}

export function removeAdviserMember(memberId: string): Promise<ApiResult<AdviserDirectoryMember>> {
  return invoke('remove_adviser_member', { p_membership_id: memberId }, directoryMemberFromRow);
}
