import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderCertificatePdf } from '../issue-certificate/render_certificate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonObject = Record<string, unknown>;
type DbResult<T = unknown> = { data: T | null; error: { message?: string } | null };
type SessionClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc: (name: string, args: JsonObject) => Promise<DbResult>;
};
type ServiceClient = {
  rpc: (name: string, args: JsonObject) => Promise<DbResult>;
  storage: { from: (bucket: string) => {
    upload: (path: string, file: Uint8Array, options: { contentType: string; cacheControl: string; upsert: false }) => Promise<{ error: unknown }>;
    remove: (paths: string[]) => Promise<{ error: unknown }>;
  } };
};

type RegenerationDependencies = {
  getConfig: () => { projectUrl: string | undefined; publishableKey: string | undefined; serviceRoleKey: string | undefined };
  createSessionClient: (projectUrl: string, publishableKey: string, authorization: string) => SessionClient;
  createServiceClient: (projectUrl: string, serviceRoleKey: string) => ServiceClient;
  render: typeof renderCertificatePdf;
  createRequestId: () => string;
};

function jsonResponse(body: JsonObject, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function databaseCode(message: string): string {
  const lower = message.toLowerCase();
  const known = ['validation_failed', 'conflict', 'not_available', 'not_found', 'forbidden', 'session_expired'];
  return known.find((code) => lower.includes(code)) ?? 'network';
}

function statusFor(code: string): number {
  if (code === 'validation_failed') return 400;
  if (code === 'session_expired') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'conflict' || code === 'not_available') return 409;
  return 502;
}

function defaultDependencies(): RegenerationDependencies {
  return {
    getConfig: () => ({
      projectUrl: Deno.env.get('SUPABASE_URL'),
      publishableKey: Deno.env.get('SUPABASE_ANON_KEY'),
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    }),
    createSessionClient: (projectUrl, publishableKey, authorization) => createClient(projectUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as SessionClient,
    createServiceClient: (projectUrl, serviceRoleKey) => createClient(projectUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as ServiceClient,
    render: renderCertificatePdf,
    createRequestId: () => crypto.randomUUID(),
  };
}

function isRegenerationInput(value: unknown, registrationId: string): value is JsonObject & {
  registrationId: string;
  seminarId: string;
  serial: string;
  status: 'issued';
  objectPath: string;
  template: JsonObject;
  seminarTitle: string;
  studentName: string;
} {
  return isObject(value)
    && value.registrationId === registrationId
    && validUuid(value.seminarId)
    && typeof value.serial === 'string'
    && value.status === 'issued'
    && typeof value.objectPath === 'string'
    && isObject(value.template)
    && typeof value.seminarTitle === 'string'
    && typeof value.studentName === 'string';
}

async function removeCandidate(serviceClient: ServiceClient, objectPath: string): Promise<void> {
  try {
    const { error } = await serviceClient.storage.from('certificates').remove([objectPath]);
    if (error) console.error('Certificate regeneration candidate cleanup failed.');
  } catch {
    console.error('Certificate regeneration candidate cleanup failed.');
  }
}

export function createRegenerationHandler(dependencies: RegenerationDependencies = defaultDependencies()) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return jsonResponse({ code: 'validation_failed' }, 405);

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ code: 'session_expired' }, 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ code: 'validation_failed' }, 400);
    }
    if (!isObject(body) || !validUuid(body.registrationId)
      || Object.keys(body).some((key) => key !== 'registrationId')) {
      return jsonResponse({ code: 'validation_failed' }, 400);
    }
    const registrationId = body.registrationId;

    const config = dependencies.getConfig();
    if (!config.projectUrl || !config.publishableKey || !config.serviceRoleKey) {
      return jsonResponse({ code: 'configuration_error' }, 500);
    }

    let sessionClient: SessionClient;
    try {
      sessionClient = dependencies.createSessionClient(config.projectUrl, config.publishableKey, authorization);
    } catch {
      return jsonResponse({ code: 'network' }, 502);
    }
    let user: { id: string } | null;
    try {
      const result = await sessionClient.auth.getUser();
      user = result.data.user;
      if (result.error || !user?.id) return jsonResponse({ code: 'session_expired' }, 401);
    } catch {
      return jsonResponse({ code: 'network' }, 502);
    }

    let generationInput: unknown;
    let inputError: { message?: string } | null;
    try {
      const result = await sessionClient.rpc('get_certificate_regeneration_input', {
        p_registration_id: registrationId,
      });
      generationInput = result.data;
      inputError = result.error;
    } catch {
      return jsonResponse({ code: 'network' }, 502);
    }
    if (inputError) {
      const code = databaseCode(inputError.message ?? '');
      return jsonResponse({ code }, statusFor(code));
    }
    if (!isRegenerationInput(generationInput, registrationId)
      || generationInput.objectPath !== `${generationInput.seminarId}/${registrationId}.pdf`) {
      return jsonResponse({ code: 'not_available' }, 409);
    }

    let pdf: Uint8Array;
    try {
      pdf = await dependencies.render({
        template: generationInput.template as Parameters<typeof renderCertificatePdf>[0]['template'],
        studentName: generationInput.studentName,
        seminarTitle: generationInput.seminarTitle,
        serial: generationInput.serial,
      });
    } catch (error) {
      const code = error instanceof Error && error.message.includes('validation_failed') ? 'validation_failed' : 'network';
      return jsonResponse({ code }, statusFor(code));
    }

    const requestId = dependencies.createRequestId();
    if (!validUuid(requestId)) return jsonResponse({ code: 'network' }, 502);
    const newObjectPath = `${generationInput.seminarId}/${registrationId}/${requestId}.pdf`;
    let serviceClient: ServiceClient;
    try {
      serviceClient = dependencies.createServiceClient(config.projectUrl, config.serviceRoleKey);
    } catch {
      return jsonResponse({ code: 'network' }, 502);
    }
    try {
      const { error: uploadError } = await serviceClient.storage.from('certificates').upload(newObjectPath, pdf, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) return jsonResponse({ code: 'network' }, 502);
    } catch {
      return jsonResponse({ code: 'network' }, 502);
    }

    let finalized: unknown;
    let finalizeError: { message?: string } | null;
    try {
      const result = await serviceClient.rpc('finalize_certificate_regeneration', {
        p_registration_id: registrationId,
        p_actor_user_id: user.id,
        p_expected_object_path: generationInput.objectPath,
        p_new_object_path: newObjectPath,
        p_request_id: requestId,
      });
      finalized = result.data;
      finalizeError = result.error;
    } catch {
      // A thrown transport error may happen after the database committed; reconcile below.
      finalized = null;
      finalizeError = { message: 'network' };
    }
    if (finalizeError || !isObject(finalized)
      || finalized.serial !== generationInput.serial || finalized.objectPath !== newObjectPath) {
      // The response can be lost after the transaction commits. Re-read through the caller's
      // authorized input function before deciding whether the uploaded candidate is safe to delete.
      let committed = false;
      try {
        const { data: current, error: currentError } = await sessionClient.rpc('get_certificate_regeneration_input', {
          p_registration_id: registrationId,
        });
        committed = !currentError && isRegenerationInput(current, registrationId)
          && current.objectPath === newObjectPath && current.serial === generationInput.serial;
      } catch {
        // The transaction may have committed despite a lost response; keep the candidate on ambiguity.
      }
      if (committed) return jsonResponse({ status: 'issued', serial: generationInput.serial }, 200);

      const code = finalizeError ? databaseCode(finalizeError.message ?? '') : 'network';
      if (code === 'network') return jsonResponse({ code }, statusFor(code));
      await removeCandidate(serviceClient, newObjectPath);
      return jsonResponse({ code }, statusFor(code));
    }

    return jsonResponse({ status: 'issued', serial: generationInput.serial }, 200);
  };
}

if (import.meta.main) Deno.serve(createRegenerationHandler());
