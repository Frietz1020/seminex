begin;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000811', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000811@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000812', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '207000812@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

update public.profiles
set first_name = 'QR', last_name = 'Lifecycle', display_name = 'QR Lifecycle Test',
    program = 'IT', year_level = 3, block = 'A'
where id = '00000000-0000-4000-8000-000000000811';

insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000821', 'attendance-qr-lifecycle-org', 'Attendance QR Lifecycle Organization');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000812', 'org_member', 'active', 'Member', now());

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by
)
values (
  '00000000-0000-4000-8000-000000000831', '00000000-0000-4000-8000-000000000821',
  'QR-LIFECYCLE', 'QR Lifecycle Test', 'Issue a QR before seminar start', 'seminar',
  'Speaker', 'Hall', 'CCS', now() + interval '1 hour', now() + interval '2 hours',
  5, 'published', now(), '00000000-0000-4000-8000-000000000812'
);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at, attendance_ack_at)
values (
  '00000000-0000-4000-8000-000000000841', '00000000-0000-4000-8000-000000000831',
  '00000000-0000-4000-8000-000000000811', 'confirmed', now(), now()
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000811","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (public.issue_attendance_challenge('00000000-0000-4000-8000-000000000831')->>'challenge') ~ '^[a-f0-9]{64}$',
  'acknowledged applicant can receive a QR before seminar start'
);
select is(
  (public.issue_attendance_challenge('00000000-0000-4000-8000-000000000831')->>'expires_at')::timestamptz,
  (select ends_at + interval '1 hour' from public.seminars where id = '00000000-0000-4000-8000-000000000831'),
  'QR expires exactly one hour after scheduled seminar end'
);

reset role;
update public.seminars
set starts_at = now() - interval '3 hours', ends_at = now() - interval '2 hours'
where id = '00000000-0000-4000-8000-000000000831';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000811","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.issue_attendance_challenge('00000000-0000-4000-8000-000000000831')$$,
  'P0001', 'attendance_qr_expired', 'challenge cannot be issued at or after the fixed expiry'
);

reset role;
select ok(
  not private.attendance_challenge_is_expired('2026-11-16 12:00:00+00', '2026-11-16 12:00:00+00'),
  'challenge is still valid at the exact expiry instant'
);
select ok(
  private.attendance_challenge_is_expired('2026-11-16 12:00:00.000001+00', '2026-11-16 12:00:00+00'),
  'challenge expires immediately after the exact expiry instant'
);

select * from finish();
rollback;
