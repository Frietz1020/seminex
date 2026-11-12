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
    throw new Error('Concurrency verification only runs against a local Supabase URL.');
  }

  return { url, apiKey, adminKey };
}

const { url, apiKey, adminKey } = getLocalConfig();
const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const organizationId = randomUUID();
const seminarId = randomUUID();
const password = `Local-test-${randomUUID()}-Aa1!`;
const students = [];
const capacity = 3;
const contenderCount = 8;

async function requireNoError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

try {
  const organization = await requireNoError(
    await admin.from('organizations').insert({ id: organizationId, slug: `concurrency-${organizationId}`, name: 'Local Concurrency Test' }).select('id').single(),
    'Create local test organization',
  );

  for (let index = 0; index < contenderCount; index += 1) {
    const studentId = `20${String(Math.floor(Math.random() * 1_000_000)).padStart(7, '0')}`;
    const email = `${studentId}@gordoncollege.edu.ph`;
    const created = await requireNoError(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
      'Create local test student',
    );
    students.push({ id: created.user.id, email });
  }

  await requireNoError(
    await admin.from('seminars').insert({
      id: seminarId,
      organization_id: organization.id,
      reference: `CONC-${seminarId.slice(0, 8)}`,
      title: 'Local capacity concurrency test',
      description: 'Synthetic local fixture for atomic registration verification.',
      seminar_type: 'seminar',
      speaker_name: 'Local Test Speaker',
      venue: 'Local Test Hall',
      department: 'CCS',
      starts_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
      capacity,
      required_attendance_percent: 60,
      publication_status: 'published',
      published_at: new Date().toISOString(),
      created_by: students[0].id,
    }),
    'Create local test seminar',
  );

  const attempts = await Promise.all(students.map(async (student) => {
    const client = createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword({ email: student.email, password });
    if (signedIn.error) throw new Error(`Sign in local test student: ${signedIn.error.message}`);
    return client.rpc('register_for_seminar', { p_seminar_id: seminarId });
  }));

  const successful = attempts.filter((attempt) => !attempt.error);
  const full = attempts.filter((attempt) => attempt.error?.message === 'seminar_full');
  if (successful.length !== capacity || full.length !== contenderCount - capacity) {
    throw new Error(`Expected ${capacity} successes and ${contenderCount - capacity} seminar_full responses; received ${successful.length} and ${full.length}.`);
  }

  const activeRegistrations = await requireNoError(
    await admin.from('registrations').select('id').eq('seminar_id', seminarId).in('status', ['registered', 'confirmed']),
    'Count local active registrations',
  );
  if (activeRegistrations.length !== capacity) throw new Error(`Expected ${capacity} active rows; found ${activeRegistrations.length}.`);

  const seminarCount = await requireNoError(
    await admin.from('seminars').select('registered_count').eq('id', seminarId).single(),
    'Read local seminar registration count',
  );
  if (seminarCount.registered_count !== capacity) {
    throw new Error(`Expected registered_count ${capacity}; found ${seminarCount.registered_count}.`);
  }

  console.log(`PASS: ${successful.length} registrations succeeded; ${full.length} returned seminar_full; ${activeRegistrations.length} active rows and registered_count ${seminarCount.registered_count} remain.`);
} finally {
  await admin.from('registrations').delete().eq('seminar_id', seminarId);
  await admin.from('seminars').delete().eq('id', seminarId);
  await admin.from('organizations').delete().eq('id', organizationId);
  for (const student of students) await admin.auth.admin.deleteUser(student.id);
}
