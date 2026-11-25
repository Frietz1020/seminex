export type IssueCertificateRequest = { seminarId: string };
export type IssueFailureStage = 'request_json' | 'request_shape' | 'generation_input' | 'render' | 'storage_upload' | 'finalize';
export type IssueFailureCode = 'validation_failed' | 'not_found' | 'not_available' | 'forbidden' | 'session_expired' | 'network' | 'configuration_error';
export type IssueFailureReason = 'canvas' | 'name_box' | 'qr_box' | 'background' | 'text' | 'output_size' | 'database_rejected' | 'unclassified';

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIssueCertificateRequest(value: unknown): IssueCertificateRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'seminarId')) return null;
  if (typeof body.seminarId !== 'string' || !VALID_UUID.test(body.seminarId)) return null;
  return { seminarId: body.seminarId.toLowerCase() };
}

export function certificateFailureEvent(stage: IssueFailureStage, code: IssueFailureCode, reason?: IssueFailureReason) {
  return { stage, code, ...(reason ? { reason } : {}) } as const;
}
