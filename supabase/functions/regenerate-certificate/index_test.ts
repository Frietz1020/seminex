import { createRegenerationHandler } from './index.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
}

const registrationId = '00000000-0000-4000-8000-000000000951';
const seminarId = '00000000-0000-4000-8000-000000000931';
const actorId = '00000000-0000-4000-8000-000000000912';
const requestId = '00000000-0000-4000-8000-000000000971';
const oldObjectPath = `${seminarId}/${registrationId}.pdf`;
const newObjectPath = `${seminarId}/${registrationId}/${requestId}.pdf`;

function validInput() {
  return {
    registrationId,
    seminarId,
    serial: 'SNX-KEEP-ME',
    status: 'issued',
    objectPath: oldObjectPath,
    template: { backgroundUrl: 'data:image/png;base64,AA==', nameBox: {} },
    seminarTitle: 'Test Seminar',
    studentName: 'Certificate Recipient',
  };
}

function makeDependencies(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const sessionClient = {
    auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) },
    rpc: async (name: string): Promise<{ data: unknown; error: { message?: string } | null }> => {
      calls.push(`session:${name}`);
      return { data: validInput(), error: null };
    },
  };
  const serviceClient = {
    rpc: async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }> => {
      calls.push(`service:${name}`);
      assertEquals(args.p_expected_object_path, oldObjectPath);
      assertEquals(args.p_new_object_path, newObjectPath);
      return { data: { serial: 'SNX-KEEP-ME', objectPath: newObjectPath }, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string, _pdf: Uint8Array, options: { upsert: boolean }) => {
          calls.push(`upload:${path}`);
          assertEquals(options.upsert, false);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${paths[0]}`);
          return { error: null };
        },
      }),
    },
  };
  const dependencies = {
    getConfig: () => ({ projectUrl: 'https://example.supabase.co', publishableKey: 'publishable', serviceRoleKey: 'service' }),
    createSessionClient: () => sessionClient,
    createServiceClient: () => serviceClient,
    render: async () => new Uint8Array([37, 80, 68, 70]),
    createRequestId: () => requestId,
    ...overrides,
  };
  return { dependencies, calls, sessionClient, serviceClient };
}

function request(body: unknown, authorization = 'Bearer test-token'): Request {
  return new Request('https://local.test/functions/v1/regenerate-certificate', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

Deno.test('rejects malformed or unexpected request fields', async () => {
  const { dependencies, calls } = makeDependencies();
  const handler = createRegenerationHandler(dependencies);
  const response = await handler(request({ registrationId, seminarId }));
  assertEquals(response.status, 400);
  assertEquals((await response.json()).code, 'validation_failed');
  assertEquals(calls.length, 0);
});

Deno.test('requires a bearer session', async () => {
  const { dependencies } = makeDependencies();
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }, ''));
  assertEquals(response.status, 401);
  assertEquals((await response.json()).code, 'session_expired');
});

Deno.test('maps applicant or non-member denial without uploading', async () => {
  const { dependencies, calls, sessionClient } = makeDependencies();
  sessionClient.rpc = async () => ({ data: null, error: { message: 'not_found' } });
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 404);
  assertEquals((await response.json()).code, 'not_found');
  assertEquals(calls.some((call) => call.startsWith('upload:')), false);
});

Deno.test('uploads a versioned PDF before atomically finalizing the same issuance', async () => {
  const { dependencies, calls } = makeDependencies();
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: 'issued', serial: 'SNX-KEEP-ME' });
  assertEquals(calls, [
    'session:get_certificate_regeneration_input',
    `upload:${newObjectPath}`,
    'service:finalize_certificate_regeneration',
  ]);
});

Deno.test('deletes the candidate PDF when finalization fails before committing', async () => {
  const { dependencies, calls, serviceClient } = makeDependencies();
  serviceClient.rpc = async () => ({ data: null, error: { message: 'conflict' } });
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 409);
  assertEquals((await response.json()).code, 'conflict');
  assertEquals(calls.includes(`remove:${newObjectPath}`), true);
});

Deno.test('keeps the candidate when finalization and outcome reconciliation are unavailable', async () => {
  const { dependencies, calls, serviceClient, sessionClient } = makeDependencies();
  let lookupCount = 0;
  sessionClient.rpc = async () => {
    lookupCount++;
    if (lookupCount > 1) throw new Error('transport');
    return { data: validInput(), error: null };
  };
  serviceClient.rpc = async () => { throw new Error('transport'); };
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 502);
  assertEquals((await response.json()).code, 'network');
  assertEquals(calls.includes(`remove:${newObjectPath}`), false);
});

Deno.test('keeps a candidate when the finalizer committed but its response was lost', async () => {
  const { dependencies, calls, serviceClient, sessionClient } = makeDependencies();
  let lookupCount = 0;
  sessionClient.rpc = async () => {
    lookupCount++;
    return { data: { ...validInput(), objectPath: lookupCount > 1 ? newObjectPath : oldObjectPath }, error: null };
  };
  serviceClient.rpc = async () => ({ data: null, error: { message: 'network' } });
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).serial, 'SNX-KEEP-ME');
  assertEquals(calls.some((call) => call.startsWith('remove:')), false);
});

Deno.test('rejects unissued rows returned by the database', async () => {
  const { dependencies, sessionClient, calls } = makeDependencies();
  sessionClient.rpc = async () => ({ data: { ...validInput(), status: 'pending' }, error: null });
  const response = await createRegenerationHandler(dependencies)(request({ registrationId }));
  assertEquals(response.status, 409);
  assertEquals((await response.json()).code, 'not_available');
  assertEquals(calls.some((call) => call.startsWith('upload:')), false);
});
