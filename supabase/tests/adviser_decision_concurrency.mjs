import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function getLocalConfig() {
  const status = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const config = JSON.parse(status);
  const url = config.API_URL;
  const apiKey = config.ANON_KEY ?? config.PUBLISHABLE_KEY;
  const adminKey = config.SERVICE_ROLE_KEY ?? config.SECRET_KEY;

  if (!url || !apiKey || !adminKey) throw new Error('Local Supabase status did not include API credentials.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('Adviser concurrency verification only runs against a local Supabase URL.');
  }

  return { url, apiKey, adminKey };
}

async function requireNoError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

const { url, apiKey, adminKey } = getLocalConfig();
const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const organizationId = randomUUID();
const adviserEmail = `adviser-${organizationId}@gordoncollege.edu.ph`;
const applicantEmail = `applicant-${organizationId}@gordoncollege.edu.ph`;
const password = `Local-test-${randomUUID()}-Aa1!`;
let adviserId;
let applicantId;
const createdRequestId = randomUUID();

try {
  const adviser = await requireNoError(
    await admin.auth.admin.createUser({ email: adviserEmail, password, email_confirm: true }),
    'Create local adviser',
  );
  adviserId = adviser.user.id;

  const applicant = await requireNoError(
    await admin.auth.admin.createUser({ email: applicantEmail, password, email_confirm: true }),
    'Create local applicant',
  );
  applicantId = applicant.user.id;

  await requireNoError(
    await admin.from('organizations').insert({
      id: organizationId,
      slug: `adviser-concurrency-${organizationId}`,
      name: 'Local adviser concurrency test',
      department: 'CCS',
    }),
    'Create local test organization',
  );

  await requireNoError(
    await admin.from('organization_memberships').insert({
      organization_id: organizationId,
      user_id: adviserId,
      role: 'adviser',
      status: 'active',
    }),
    'Assign local adviser',
  );

  await requireNoError(
    await admin.from('organization_access_requests').insert({
      id: createdRequestId,
      organization_id: organizationId,
      user_id: applicantId,
      position: 'Secretary',
      statement: 'Synthetic local concurrency fixture.',
      status: 'pending',
    }),
    'Create local pending request',
  );

  const adviserClientA = createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const adviserClientB = createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [loginA, loginB] = await Promise.all([
    adviserClientA.auth.signInWithPassword({ email: adviserEmail, password }),
    adviserClientB.auth.signInWithPassword({ email: adviserEmail, password }),
  ]);
  if (loginA.error || loginB.error) {
    throw new Error(`Sign in local adviser clients: ${loginA.error?.message ?? loginB.error?.message}`);
  }

  const attempts = await Promise.all(
    [adviserClientA, adviserClientB].map((client) => client.rpc('decide_adviser_org_request', {
      p_request_id: createdRequestId,
      p_decision: 'approved',
      p_decision_note: null,
    })),
  );
  const successful = attempts.filter((result) => !result.error);
  const conflicts = attempts.filter((result) => result.error?.message.includes('conflict'));
  if (successful.length !== 1 || conflicts.length !== 1) {
    throw new Error(`Expected one approval and one conflict; got ${successful.length} approvals and ${conflicts.length} conflicts.`);
  }

  const savedRequest = await requireNoError(
    await admin.from('organization_access_requests').select('status').eq('id', createdRequestId).single(),
    'Read saved local request',
  );
  if (savedRequest.status !== 'approved') throw new Error(`Expected approved request; found ${savedRequest.status}.`);

  const memberships = await requireNoError(
    await admin.from('organization_memberships')
      .select('id,status')
      .eq('organization_id', organizationId)
      .eq('user_id', applicantId),
    'Read saved local membership',
  );
  if (memberships.length !== 1 || memberships[0].status !== 'active') {
    throw new Error(`Expected one active membership; found ${memberships.length} rows.`);
  }

  console.log('PASS: concurrent adviser decisions produced one approval, one conflict, and one active membership.');
} finally {
  if (createdRequestId) await admin.from('organization_access_requests').delete().eq('id', createdRequestId);
  if (organizationId) {
    await admin.from('organization_memberships').delete().eq('organization_id', organizationId);
    await admin.from('organizations').delete().eq('id', organizationId);
  }
  if (adviserId) await admin.auth.admin.deleteUser(adviserId);
  if (applicantId) await admin.auth.admin.deleteUser(applicantId);
}
