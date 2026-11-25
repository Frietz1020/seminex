import { createClient } from 'npm:@supabase/supabase-js@2';
import { CertificateValidationError, renderCertificatePdf } from './render_certificate.ts';
import { certificateFailureEvent, parseIssueCertificateRequest } from './request.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonObject = Record<string, unknown>;
type ApiCode = 'validation_failed' | 'not_found' | 'not_available' | 'forbidden' | 'session_expired' | 'network' | 'configuration_error';

function jsonResponse(body: JsonObject, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCode(message: string): ApiCode {
  const lower = message.toLowerCase();
  const values: ApiCode[] = ['validation_failed', 'not_available', 'not_found', 'forbidden', 'session_expired'];
  return values.find((value) => lower.includes(value)) ?? 'network';
}

function errorStatus(code: ApiCode): number {
  if (code === 'session_expired') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'validation_failed') return 400;
  if (code === 'not_available') return 409;
  if (code === 'configuration_error') return 500;
  return 502;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ code: 'validation_failed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ code: 'session_expired' }, 401);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !publishableKey || !serviceRoleKey) return jsonResponse({ code: 'configuration_error' }, 500);

  const sessionClient = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user) return jsonResponse({ code: 'session_expired' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error('Certificate issuance failed.', certificateFailureEvent('request_json', 'validation_failed'));
    return jsonResponse({ code: 'validation_failed' }, 400);
  }
  const issueRequest = parseIssueCertificateRequest(body);
  if (!issueRequest) {
    console.error('Certificate issuance failed.', certificateFailureEvent('request_shape', 'validation_failed'));
    return jsonResponse({ code: 'validation_failed' }, 400);
  }

  const { data: generationInput, error: inputError } = await sessionClient.rpc('get_certificate_generation_input', {
    p_seminar_id: issueRequest.seminarId,
  });
  if (inputError) {
    const code = errorCode(inputError.message);
    console.error('Certificate issuance failed.', certificateFailureEvent('generation_input', code, code === 'validation_failed' ? 'database_rejected' : undefined));
    return jsonResponse({ code }, errorStatus(code));
  }
  if (!isObject(generationInput) || typeof generationInput.registrationId !== 'string'
    || typeof generationInput.serial !== 'string' || typeof generationInput.status !== 'string'
    || !isObject(generationInput.template) || typeof generationInput.studentName !== 'string'
    || typeof generationInput.seminarTitle !== 'string') {
    console.error('Certificate issuance failed.', certificateFailureEvent('generation_input', 'network', 'unclassified'));
    return jsonResponse({ code: 'network' }, 502);
  }
  if (generationInput.status === 'issued') {
    return jsonResponse({ status: 'issued', serial: generationInput.serial }, 200);
  }
  if (generationInput.status !== 'pending' || typeof generationInput.registrationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(generationInput.registrationId)) {
    return jsonResponse({ code: 'not_available' }, 409);
  }

  let pdf: Uint8Array;
  try {
    pdf = await renderCertificatePdf({
      template: generationInput.template as Parameters<typeof renderCertificatePdf>[0]['template'],
      studentName: generationInput.studentName,
      seminarTitle: generationInput.seminarTitle,
      serial: generationInput.serial,
    });
  } catch (error) {
    const code = error instanceof Error && error.message.includes('validation_failed') ? 'validation_failed' : 'network';
    const reason = error instanceof CertificateValidationError ? error.reason : undefined;
    console.error('Certificate issuance failed.', certificateFailureEvent('render', code, reason));
    return jsonResponse({ code }, errorStatus(code));
  }

  const objectPath = `${issueRequest.seminarId}/${generationInput.registrationId.toLowerCase()}.pdf`;
  const serviceClient = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: uploadError } = await serviceClient.storage.from('certificates').upload(objectPath, pdf, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) {
    console.error('Certificate issuance failed.', certificateFailureEvent('storage_upload', 'network'));
    return jsonResponse({ code: 'network' }, 502);
  }

  const { data: finalized, error: finalizeError } = await serviceClient.rpc('finalize_certificate_issuance', {
    p_registration_id: generationInput.registrationId,
    p_object_path: objectPath,
  });
  if (finalizeError) {
    const { data: currentIssuance, error: currentError } = await sessionClient.rpc('get_my_certificate', {
      p_seminar_id: issueRequest.seminarId,
    });
    if (!currentError && isObject(currentIssuance) && currentIssuance.status === 'issued'
      && currentIssuance.object_path === objectPath) {
      return jsonResponse({ status: 'issued', serial: generationInput.serial }, 200);
    }
    if (!currentError && isObject(currentIssuance) && currentIssuance.status === 'pending') {
      const { error: cleanupError } = await serviceClient.storage.from('certificates').remove([objectPath]);
      if (cleanupError) console.error('Certificate issuance cleanup failed.', certificateFailureEvent('storage_upload', 'network'));
    }
    const code = errorCode(finalizeError.message);
    console.error('Certificate issuance failed.', certificateFailureEvent('finalize', code, code === 'validation_failed' ? 'database_rejected' : undefined));
    return jsonResponse({ code }, errorStatus(code));
  }
  if (!isObject(finalized) || finalized.status !== 'issued' || finalized.object_path !== objectPath) {
    console.error('Certificate issuance failed.', certificateFailureEvent('finalize', 'network', 'unclassified'));
    return jsonResponse({ code: 'network' }, 502);
  }

  return jsonResponse({ status: 'issued', serial: generationInput.serial }, 200);
});
