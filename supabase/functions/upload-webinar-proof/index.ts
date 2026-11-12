import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ code: 'validation_failed' }, 400);
  }
  const seminarId = form.get('seminarId');
  const kind = form.get('kind');
  const idempotencyKey = form.get('idempotencyKey');
  const file = form.get('file');
  if (typeof seminarId !== 'string' || !/^[0-9a-f-]{36}$/i.test(seminarId)
    || (kind !== 'time_in' && kind !== 'time_out')
    || typeof idempotencyKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)
    || !(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    return jsonResponse({ code: 'validation_failed' }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
    && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) return jsonResponse({ code: 'validation_failed' }, 400);

  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const extension = isPng ? 'png' : 'jpg';
  const objectPath = `${user.id}/${seminarId}/${crypto.randomUUID()}.${extension}`;
  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: uploadError } = await adminClient.storage.from('webinar-proofs').upload(objectPath, bytes, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) return jsonResponse({ code: 'network' }, 502);

  const { data: proof, error: proofError } = await adminClient.rpc('register_webinar_proof', {
    p_student_user_id: user.id,
    p_seminar_id: seminarId,
    p_kind: kind,
    p_object_path: objectPath,
    p_content_type: contentType,
    p_byte_size: bytes.byteLength,
    p_idempotency_key: idempotencyKey,
  });
  if (proofError) {
    await adminClient.storage.from('webinar-proofs').remove([objectPath]);
    const code = ['forbidden', 'not_available', 'conflict', 'validation_failed'].find((candidate) => proofError.message.includes(candidate)) ?? 'network';
    const status = code === 'forbidden' ? 403 : code === 'not_available' ? 409 : code === 'validation_failed' ? 400 : 409;
    return jsonResponse({ code }, status);
  }

  if (proof.object_path !== objectPath) {
    await adminClient.storage.from('webinar-proofs').remove([objectPath]);
  }

  return jsonResponse({ proof }, 201);
});
