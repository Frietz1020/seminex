begin;

select plan(32);

select ok(not (select public from storage.buckets where id = 'webinar-proofs'), 'webinar proof bucket remains private');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000711@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000712@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000713@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000714', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000714@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000715', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000715@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

update public.profiles
set first_name = case id
  when '00000000-0000-4000-8000-000000000711' then 'Attendee Student'
  when '00000000-0000-4000-8000-000000000712' then 'Scanning Officer'
  else 'Unrelated Student'
end,
last_name = 'Test',
display_name = case id
  when '00000000-0000-4000-8000-000000000711' then 'Attendee Student Test'
  when '00000000-0000-4000-8000-000000000712' then 'Scanning Officer Test'
  else 'Unrelated Student Test'
end,
program = 'IT', year_level = 3, block = 'A', avatar_url = 'https://example.test/avatar.png'
where id in (
  '00000000-0000-4000-8000-000000000711',
  '00000000-0000-4000-8000-000000000712',
  '00000000-0000-4000-8000-000000000713',
  '00000000-0000-4000-8000-000000000714',
  '00000000-0000-4000-8000-000000000715'
);

insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000721', 'attendance-proof-org', 'Attendance Proof Organization');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000712', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000714', 'adviser', 'active', null, null);

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by, join_url
)
values
  ('00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000721', 'ATTENDANCE-SEMINAR', 'Attendance Seminar', 'Scan tests', 'seminar', 'Speaker', 'Hall', 'CCS', now() - interval '10 minutes', now() + interval '2 hours', 5, 'published', now(), '00000000-0000-4000-8000-000000000712', null),
  ('00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000721', 'ATTENDANCE-WEBINAR', 'Attendance Webinar', 'Proof tests', 'webinar', 'Speaker', '', 'CCS', now() - interval '10 minutes', now() + interval '2 hours', 5, 'published', now(), '00000000-0000-4000-8000-000000000712', 'https://meet.example.test/private'),
  ('00000000-0000-4000-8000-000000000733', '00000000-0000-4000-8000-000000000721', 'ATTENDANCE-OTHER-SEMINAR', 'Other Attendance Seminar', 'Wrong-seminar challenge test', 'seminar', 'Speaker', 'Hall', 'CCS', now() - interval '10 minutes', now() + interval '2 hours', 5, 'published', now(), '00000000-0000-4000-8000-000000000712', null);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at)
values
  ('00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000711', 'confirmed', now()),
  ('00000000-0000-4000-8000-000000000742', '00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000711', 'confirmed', now()),
  ('00000000-0000-4000-8000-000000000743', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000713', 'released', null),
  ('00000000-0000-4000-8000-000000000744', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000715', 'confirmed', now()),
  ('00000000-0000-4000-8000-000000000745', '00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000715', 'confirmed', now());

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;

select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000711', 'manual', 'Verified student identity', '00000000-0000-4000-8000-000000000751'::uuid)->'entry'->>'kind'),
  'time_in',
  'first accepted scan records Time-In'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000714","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000715', 'qr', null, '00000000-0000-4000-8000-000000000755')$$,
  'P0001', 'forbidden', 'an adviser cannot record officer attendance scans'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000711', 'manual', 'Verified student identity', '00000000-0000-4000-8000-000000000751'::uuid)->'student'->>'program'),
  'IT',
  'scan response contains roster fields for the face check'
);
select is(
  (select officer_user_id::text from public.attendance_ledger where idempotency_key = '00000000-0000-4000-8000-000000000751'),
  '00000000-0000-4000-8000-000000000712',
  'server records authenticated officer identity'
);
select ok(
  (select event_at between now() - interval '1 minute' and now() + interval '1 minute' from public.attendance_ledger where idempotency_key = '00000000-0000-4000-8000-000000000751'),
  'server assigns attendance timestamp'
);
select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000711', 'manual', 'Verified student identity', '00000000-0000-4000-8000-000000000751'::uuid)->'entry'->>'kind'),
  'time_in',
  'retry with the same idempotency key returns the original punch'
);
select is((select count(*)::integer from public.attendance_ledger where registration_id = '00000000-0000-4000-8000-000000000741'), 1, 'retry does not append another ledger entry');
select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000711', 'manual', 'Verified student identity', '00000000-0000-4000-8000-000000000752'::uuid)->'entry'->>'kind'),
  'time_out',
  'second unique scan records Time-Out'
);
select throws_ok(
  $$select public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000713', 'manual', 'Verified student identity', '00000000-0000-4000-8000-000000000753')$$,
  'P0001', 'not_found', 'released roster entry is rejected'
);
select throws_ok(
  $$insert into public.attendance_ledger (seminar_id, registration_id, student_user_id, kind, event_at, method, officer_user_id, idempotency_key) values ('00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000711', 'time_in', now(), 'qr', '00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000754')$$,
  '42501', null, 'client cannot directly insert attendance ledger rows'
);

select throws_ok(
  $$select public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000715', 'qr', null, '00000000-0000-4000-8000-000000000756')$$,
  'P0001', 'validation_failed', 'legacy Student ID QR scans are rejected'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000715","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.scan_challenge', public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'challenge', true);
select ok(length(current_setting('test.scan_challenge')) = 64, 'active registration receives an opaque challenge');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000733', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000757')$$,
  'P0001', 'not_found', 'a challenge cannot be used for a different seminar'
);
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000758')->'entry'->>'kind',
  'time_in', 'challenge records the owning registration time-in'
);
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000758')->'student'->>'studentId',
  '207000715', 'challenge resolves to its bound registration, not a supplied Student ID'
);
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000759')$$,
  'P0001', 'conflict', 'copied challenge replay with another idempotency key is rejected'
);
select is((select count(*)::integer from public.attendance_ledger where registration_id = '00000000-0000-4000-8000-000000000744'), 1, 'challenge retry creates one ledger entry');
reset role;
update private.registration_scan_challenges
set expires_at = now() - interval '1 second'
where challenge_hash = extensions.digest(current_setting('test.scan_challenge'), 'sha256');
set local role authenticated;
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000760')$$,
  'P0001', 'not_available', 'expired challenge is rejected'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000715","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.scan_challenge', public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'challenge', true);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.scan_challenge'), '00000000-0000-4000-8000-000000000761')->'entry'->>'kind',
  'time_out', 'a fresh challenge permits one Time-Out after Time-In'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000715","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')$$,
  'P0001', 'not_available', 'no further checkpoint is issued after Time-Out'
);

reset role;
set local role service_role;
select throws_ok(
  $$select public.register_webinar_proof('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000732', 'time_out', '00000000-0000-4000-8000-000000000711/00000000-0000-4000-8000-000000000732/11111111-1111-4111-8111-111111111111.jpg', 'image/jpeg', 1000, '00000000-0000-4000-8000-000000000761')$$,
  'P0001', 'not_available', 'webinar proof upload outside its window is rejected'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000711","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.list_webinar_proofs('00000000-0000-4000-8000-000000000732')$$,
  'P0001', 'forbidden', 'a student cannot read the organization review queue'
);
select throws_ok(
  $$insert into public.webinar_proofs (seminar_id, registration_id, student_user_id, kind, object_path, content_type, byte_size, submitted_at, idempotency_key) values ('00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000742', '00000000-0000-4000-8000-000000000711', 'time_in', 'path', 'image/png', 1000, now(), '00000000-0000-4000-8000-000000000764')$$,
  '42501', null, 'students cannot bypass the authenticated multipart upload function'
);
reset role;
set local role service_role;
select is((select status from public.register_webinar_proof(
  '00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000732', 'time_in',
  '00000000-0000-4000-8000-000000000711/00000000-0000-4000-8000-000000000732/22222222-2222-4222-8222-222222222222.png',
  'image/png', 2048, '00000000-0000-4000-8000-000000000762')), 'pending', 'valid webinar proof is accepted for review');
select public.register_webinar_proof(
  '00000000-0000-4000-8000-000000000715', '00000000-0000-4000-8000-000000000732', 'time_in',
  '00000000-0000-4000-8000-000000000715/00000000-0000-4000-8000-000000000732/44444444-4444-4444-8444-444444444444.png',
  'image/png', 2048, '00000000-0000-4000-8000-000000000765');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000714","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.review_webinar_proof((select id from public.webinar_proofs where idempotency_key = '00000000-0000-4000-8000-000000000765'), false, 'Adviser cannot review')$$,
  'P0001', 'forbidden', 'an adviser cannot review webinar attendance proofs'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is((select status from public.review_webinar_proof(
  (select id from public.webinar_proofs where idempotency_key = '00000000-0000-4000-8000-000000000762'), false, 'Student name did not match')), 'rejected', 'authorized officer can reject proof with a reason');
reset role;
set local role service_role;
select is((select status from public.register_webinar_proof(
  '00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000732', 'time_in',
  '00000000-0000-4000-8000-000000000711/00000000-0000-4000-8000-000000000732/33333333-3333-4333-8333-333333333333.jpg',
  'image/jpeg', 2048, '00000000-0000-4000-8000-000000000763')), 'pending', 'rejected proof may be replaced in the valid upload window');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is((select status from public.review_webinar_proof(
  (select id from public.webinar_proofs where idempotency_key = '00000000-0000-4000-8000-000000000763'), true, null)), 'approved', 'authorized officer can approve replacement proof');
select is((select count(*)::integer from public.attendance_ledger where seminar_id = '00000000-0000-4000-8000-000000000732' and method = 'webinar_proof'), 1, 'approval appends exactly one webinar attendance entry');
select is((select event_at from public.attendance_ledger where seminar_id = '00000000-0000-4000-8000-000000000732' and method = 'webinar_proof'), (select submitted_at from public.webinar_proofs where idempotency_key = '00000000-0000-4000-8000-000000000763'), 'approval uses the submission timestamp for attendance');
select is((select officer_user_id::text from public.attendance_ledger where seminar_id = '00000000-0000-4000-8000-000000000732' and method = 'webinar_proof'), '00000000-0000-4000-8000-000000000712', 'approval records the authenticated reviewing officer');

select * from finish();
rollback;
