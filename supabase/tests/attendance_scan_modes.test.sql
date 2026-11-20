begin;

select plan(23);

select ok(private.attendance_scan_window(
  '2026-11-16 10:00:00+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_in'
), 'Time-In accepts exactly at seminar start');
select ok(not private.attendance_scan_window(
  '2026-11-16 09:59:59.999999+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_in'
), 'Time-In rejects immediately before seminar start');
select ok(private.attendance_scan_window(
  '2026-11-16 10:59:59.999999+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_in'
), 'Time-In accepts immediately before seminar end');
select ok(not private.attendance_scan_window(
  '2026-11-16 11:00:00+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_in'
), 'Time-In rejects exactly at seminar end');
select ok(private.attendance_scan_window(
  '2026-11-16 12:00:00+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_out'
), 'Time-Out accepts exactly one hour after seminar end');
select ok(not private.attendance_scan_window(
  '2026-11-16 12:00:00.000001+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_out'
), 'Time-Out rejects one microsecond after its deadline');
select ok(
  not private.attendance_challenge_is_expired('2026-11-16 12:00:00+00', '2026-11-16 12:00:00+00')
    and private.attendance_scan_window('2026-11-16 12:00:00+00', '2026-11-16 10:00:00+00', '2026-11-16 11:00:00+00', 'time_out'),
  'Time-Out remains valid at the exact QR expiry and grace-window deadline'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000711@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000712@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000713@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000714', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000714@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000715', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000715@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000716', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000716@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000717', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000717@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

update public.profiles
set first_name = 'Attendance', last_name = 'Mode Test', display_name = 'Attendance Mode Test',
    program = 'IT', year_level = 3, block = 'A'
where id between '00000000-0000-4000-8000-000000000711'::uuid and '00000000-0000-4000-8000-000000000717'::uuid;

insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000721', 'scan-mode-test-org', 'Scan Mode Test Organization');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000712', 'org_member', 'active', 'Member', now());

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by
)
values (
  '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000721',
  'SCAN-MODE-TEST', 'Scan Mode Test', 'Isolated attendance scan mode fixture', 'seminar',
  'Speaker', 'Hall', 'CCS', now() - interval '10 minutes', now() + interval '2 hours',
  10, 'published', now(), '00000000-0000-4000-8000-000000000712'
);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at, attendance_ack_at)
values
  ('00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000711', 'confirmed', now(), now()),
  ('00000000-0000-4000-8000-000000000742', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000713', 'confirmed', now(), now()),
  ('00000000-0000-4000-8000-000000000743', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000714', 'confirmed', now(), now()),
  ('00000000-0000-4000-8000-000000000744', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000715', 'confirmed', now(), now()),
  ('00000000-0000-4000-8000-000000000745', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000716', 'confirmed', now(), now()),
  ('00000000-0000-4000-8000-000000000746', '00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000717', 'confirmed', now(), now());

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000711","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.time_in_challenge', public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'challenge', true) is not null;
select set_config('test.duplicate_time_in_challenge', public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'challenge', true) is not null;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000751', 'time_in')->'entry'->>'kind',
  'time_in', 'selected Time-In records when the registration has no Time-In'
);
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000751', 'time_in')->'entry'->>'kind',
  'time_in', 'retry with the same mode and idempotency key returns the original entry'
);
reset role;
update private.registration_scan_challenges
set consumed_at = now(),
    consumed_officer_id = '00000000-0000-4000-8000-000000000712',
    idempotency_key = '00000000-0000-4000-8000-000000000751',
    ledger_id = (select id from public.attendance_ledger where officer_user_id = '00000000-0000-4000-8000-000000000712' and idempotency_key = '00000000-0000-4000-8000-000000000751')
where challenge_hash = extensions.digest(current_setting('test.time_in_challenge'), 'sha256');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000752', 'time_out')->'entry'->>'kind',
  'time_out', 'the same challenge records Time-Out even when its legacy consumed marker was set after Time-In'
);
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.duplicate_time_in_challenge'), '00000000-0000-4000-8000-000000000764', 'time_in')$$,
  'P0001', 'attendance_already_recorded', 'duplicate Time-In is rejected while awaiting Time-Out'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000713","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.early_time_out_challenge', public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'challenge', true) is not null;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.early_time_out_challenge'), '00000000-0000-4000-8000-000000000753', 'time_out')$$,
  'P0001', 'wrong_attendance_step', 'Time-Out before Time-In is rejected'
);
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.early_time_out_challenge'), '00000000-0000-4000-8000-000000000765', 'time_in')->'entry'->>'kind',
  'time_in', 'a Time-In scan can follow a rejected premature Time-Out with the same QR'
);
reset role;
update private.registration_scan_challenges
set expires_at = now() - interval '1 second'
where challenge_hash = extensions.digest(current_setting('test.early_time_out_challenge'), 'sha256');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.early_time_out_challenge'), '00000000-0000-4000-8000-000000000765', 'time_in')->'entry'->>'kind',
  'time_in', 'idempotent retry returns its original success after challenge expiry'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000762', 'time_in')$$,
  'P0001', 'attendance_already_recorded', 'repeating Time-In after Time-Out reports the already-recorded mode'
);
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000763', 'time_out')$$,
  'P0001', 'attendance_already_recorded', 'repeating Time-Out reports the already-recorded mode'
);
reset role;
select is(
  (select count(*)::integer from public.attendance_ledger where registration_id = '00000000-0000-4000-8000-000000000741'),
  2, 'one Time-In and one Time-Out ledger event are recorded'
);
select ok((
  select registration.time_in_at = time_in.event_at and registration.time_out_at = time_out.event_at
  from public.registrations registration
  join public.attendance_ledger time_in on time_in.registration_id = registration.id and time_in.kind = 'time_in'
  join public.attendance_ledger time_out on time_out.registration_id = registration.id and time_out.kind = 'time_out'
  where registration.id = '00000000-0000-4000-8000-000000000741'
), 'registration summary timestamps match their ledger events');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000712","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.duplicate_time_in_challenge'), '00000000-0000-4000-8000-000000000755', 'time_in')$$,
  'P0001', 'attendance_already_recorded', 'a repeated mode remains explicitly rejected after Time-Out'
);

select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000714', 'manual', null, '00000000-0000-4000-8000-000000000756')->'entry'->>'reason'),
  null, 'manual entry accepts an omitted reason and stores null'
);
select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000715', 'manual', '   ', '00000000-0000-4000-8000-000000000757')->'entry'->>'reason'),
  null, 'manual entry normalizes a blank reason to null'
);
select is(
  (public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000716', 'manual', '  ID verified  ', '00000000-0000-4000-8000-000000000758')->'entry'->>'reason'),
  'ID verified', 'manual entry trims and stores a supplied reason'
);
select throws_ok(
  $$select public.record_org_scan('00000000-0000-4000-8000-000000000731', '207000717', 'manual', repeat('x', 501), '00000000-0000-4000-8000-000000000759')$$,
  'P0001', 'validation_failed', 'manual reason over 500 characters is rejected'
);

select * from finish();
rollback;
