begin;

select plan(72);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000611@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000612@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000613', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000613@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000614', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000614@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000621', 'registration-rules-org', 'Registration Rules Organization');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000621', '00000000-0000-4000-8000-000000000613', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000621', '00000000-0000-4000-8000-000000000614', 'adviser', 'active', null, null);

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by, join_url
)
values
  ('00000000-0000-4000-8000-000000000631', '00000000-0000-4000-8000-000000000621', 'RULES-UNCONFIRMED', 'Unconfirmed Seminar', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '48 hours', now() + interval '50 hours', 1, 'published', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000632', '00000000-0000-4000-8000-000000000621', 'RULES-IN-WINDOW', 'Open Window Seminar', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '12 hours', now() + interval '14 hours', 3, 'published', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000633', '00000000-0000-4000-8000-000000000621', 'RULES-CONFIRM', 'Confirmation Seminar', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '48 hours', now() + interval '50 hours', 3, 'published', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000634', '00000000-0000-4000-8000-000000000621', 'RULES-EXPIRED', 'Expired Seminar', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '30 minutes', now() + interval '2 hours', 1, 'published', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000635', '00000000-0000-4000-8000-000000000621', 'RULES-TIME-IN', 'Already Checked In', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '12 hours', now() + interval '14 hours', 3, 'published', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000636', '00000000-0000-4000-8000-000000000621', 'RULES-CANCELLED', 'Cancelled Seminar', 'Registration rules', 'seminar', 'Speaker', 'Hall', 'CCS', now() + interval '12 hours', now() + interval '14 hours', 3, 'cancelled', now(), '00000000-0000-4000-8000-000000000613', null),
  ('00000000-0000-4000-8000-000000000637', '00000000-0000-4000-8000-000000000621', 'RULES-WEBINAR', 'Gated Webinar', 'Webinar access rules', 'webinar', 'Speaker', '', 'CCS', now() + interval '30 minutes', now() + interval '2 hours', 3, 'published', now(), '00000000-0000-4000-8000-000000000613', 'https://meet.example.test/private-session');

insert into public.registrations (id, seminar_id, student_user_id, status, registered_at)
values (
  '00000000-0000-4000-8000-000000000641',
  '00000000-0000-4000-8000-000000000634',
  '00000000-0000-4000-8000-000000000611',
  'registered',
  now() - interval '2 hours'
);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at)
values (
  '00000000-0000-4000-8000-000000000643',
  '00000000-0000-4000-8000-000000000632',
  '00000000-0000-4000-8000-000000000612',
  'confirmed',
  now()
);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at, time_in_at)
values (
  '00000000-0000-4000-8000-000000000642',
  '00000000-0000-4000-8000-000000000635',
  '00000000-0000-4000-8000-000000000611',
  'confirmed',
  now() - interval '2 hours',
  now()
);

insert into public.registrations (id, seminar_id, student_user_id, status)
values (
  '00000000-0000-4000-8000-000000000644',
  '00000000-0000-4000-8000-000000000636',
  '00000000-0000-4000-8000-000000000612',
  'registered'
);

insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at)
values (
  '00000000-0000-4000-8000-000000000645',
  '00000000-0000-4000-8000-000000000637',
  '00000000-0000-4000-8000-000000000612',
  'confirmed',
  now()
), (
  '00000000-0000-4000-8000-000000000646',
  '00000000-0000-4000-8000-000000000637',
  '00000000-0000-4000-8000-000000000611',
  'registered',
  null
);

insert into public.seminar_drafts (id, organization_id, created_by, details, certificate_template, survey_definition)
values (
  '00000000-0000-4000-8000-000000000651',
  '00000000-0000-4000-8000-000000000621',
  '00000000-0000-4000-8000-000000000613',
  '{"title":"Ready seminar","description":"A complete seminar","seminarType":"seminar","speakerName":"Speaker Name","speakerRole":"Faculty","venue":"CCS Hall","department":"CCS","startsAt":"2030-06-02T09:00:00+08:00","endsAt":"2030-06-02T11:00:00+08:00","capacity":10}',
  '{"backgroundUrl":"private/template.png","nameBox":{"x":1,"y":1,"width":20,"height":5}}',
  '{"id":"survey-ready-seminar","version":1,"seminarId":"draft-ready-seminar","title":"Evaluation","instructions":"","sections":[{"id":"section-main","title":"Evaluation","questions":[{"id":"q1","type":"paragraph","required":false,"prompt":"How was it?","maxLength":500}]}]}'
), (
  '00000000-0000-4000-8000-000000000652',
  '00000000-0000-4000-8000-000000000621',
  '00000000-0000-4000-8000-000000000613',
  '{"title":"Invalid Topics","description":"Invalid data test","seminarType":"seminar","speakerName":"Speaker","venue":"CCS Hall","startsAt":"2030-06-02T09:00:00+08:00","endsAt":"2030-06-02T11:00:00+08:00","capacity":10,"topics":{"unsafe":"object"}}',
  '{}',
  '{"sections":[{"questions":[{"id":"q1"}]}]}'
), (
  '00000000-0000-4000-8000-000000000653',
  '00000000-0000-4000-8000-000000000621',
  '00000000-0000-4000-8000-000000000613',
  '{"title":"Invalid Webinar","description":"Invalid URL test","seminarType":"webinar","speakerName":"Speaker","startsAt":"2030-06-02T09:00:00+08:00","endsAt":"2030-06-02T11:00:00+08:00","capacity":10,"joinUrl":"http://meet.example.test"}',
  '{}',
  '{"sections":[{"questions":[{"id":"q1"}]}]}'
), (
  '00000000-0000-4000-8000-000000000654',
  '00000000-0000-4000-8000-000000000621',
  '00000000-0000-4000-8000-000000000613',
  '{"title":"Capacity Edit","description":"Capacity validation","seminarType":"seminar","speakerName":"Speaker","venue":"CCS Hall","startsAt":"2030-06-02T09:00:00+08:00","endsAt":"2030-06-02T11:00:00+08:00","capacity":1}',
  '{}',
  '{"sections":[{"questions":[{"id":"q1"}]}]}'
);

update public.seminar_drafts
set editing_seminar_id = '00000000-0000-4000-8000-000000000632'
where id = '00000000-0000-4000-8000-000000000654';

select has_function('public', 'register_for_seminar', ARRAY['uuid'], 'student registration uses a server function');
select has_function('public', 'confirm_registration', ARRAY['uuid'], 'student confirmation uses a server function');
select has_function('public', 'cancel_registration', ARRAY['uuid'], 'cancellation uses a server function');
select has_function('public', 'publish_seminar', ARRAY['uuid'], 'seminar publication uses a server function');
select has_column('public', 'seminar_drafts', 'published_seminar_id', 'published authoring metadata remains linked to its seminar');
select has_column('public', 'registration_read_model', 'seminar_ends_at', 'Student history can filter finished seminars before paging');
select has_function('public', 'create_org_edit_draft', ARRAY['uuid'], 'organization edit drafts are created by an access-checked function');
select has_function('public', 'get_webinar_join_url', ARRAY['uuid'], 'webinar links are read through an eligibility-checked function');
select ok(has_function_privilege('anon', 'public.register_for_seminar(uuid)', 'EXECUTE') is false, 'anonymous users cannot register through the server function');
select is((select count(*)::integer from cron.job where jobname = 'seminex-release-expired-registrations'), 1, 'expired registrations have one scheduled release job');
select is((select confirmation_opens_hours_before from public.seminars where id = '00000000-0000-4000-8000-000000000631'), 24, 'default confirmation opening offset is 24 hours');
select is((select confirmation_closes_hours_before from public.seminars where id = '00000000-0000-4000-8000-000000000631'), 1, 'default confirmation closing offset is one hour');
savepoint immutable_registration_seminar;
select throws_ok($$update public.registrations set seminar_id = '00000000-0000-4000-8000-000000000631' where id = '00000000-0000-4000-8000-000000000641'$$, 'P0001', 'registration_seminar_immutable', 'registration cannot be reassigned to another seminar');
rollback to savepoint immutable_registration_seminar;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
set local role authenticated;
select is((public.register_for_seminar('00000000-0000-4000-8000-000000000631')).status, 'registered', 'registration before the confirmation window starts is unconfirmed');
select is((select registered_count from public.seminars where id = '00000000-0000-4000-8000-000000000631'), 1, 'active registration increments the seminar count');
select is((select id from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), (public.register_for_seminar('00000000-0000-4000-8000-000000000631')).id, 'retrying registration returns the same registration row');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
select throws_ok($$select public.register_for_seminar('00000000-0000-4000-8000-000000000631')$$, 'P0001', 'seminar_full', 'registration at capacity returns seminar_full');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
select lives_ok($$select public.cancel_registration('00000000-0000-4000-8000-000000000631')$$, 'a student can cancel before Time-In');
select is((select registered_count from public.seminars where id = '00000000-0000-4000-8000-000000000631'), 0, 'cancellation frees the counted slot');
select is((select status from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), 'cancelled', 'cancellation keeps the same roster row');
select is((select id from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), (public.register_for_seminar('00000000-0000-4000-8000-000000000631')).id, 're-registration reactivates the same row');
select is((select status from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), 'registered', 'reactivation restores the active registration state');
select is((select registered_count from public.seminars where id = '00000000-0000-4000-8000-000000000631'), 1, 'reactivation restores the counted slot');
select is((select confirmed_at from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), null, 'reactivation clears old confirmation time');
select is((select attendance_ack_at from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000631' and student_user_id = auth.uid()), null, 'reactivation clears old attendance acknowledgement');
select is((public.register_for_seminar('00000000-0000-4000-8000-000000000632')).status, 'confirmed', 'registration during the open confirmation window is confirmed immediately');
select ok((select confirmed_at is not null from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000632' and student_user_id = auth.uid()), 'automatic confirmation uses a server timestamp');
select throws_ok($$select public.cancel_registration('00000000-0000-4000-8000-000000000635')$$, 'P0001', 'not_available', 'cancellation is rejected after Time-In');
select is((select status from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000635' and student_user_id = auth.uid()), 'confirmed', 'rejected cancellation leaves the confirmed row intact');
reset role;
select is(private.release_expired_registrations('00000000-0000-4000-8000-000000000634'), 1, 'expired unconfirmed registration is released');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
set local role authenticated;
select is((select status from public.registrations where id = '00000000-0000-4000-8000-000000000641'), 'released', 'released registration has no active slot');
select is((select status from public.registration_read_model where id = '00000000-0000-4000-8000-000000000641'), 'released', 'read model shows overdue registration as released immediately');
select is((select count(*)::integer from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000634' and status in ('registered', 'confirmed')), 0, 'released registration no longer consumes an active slot');
select is((select registered_count from public.seminars where id = '00000000-0000-4000-8000-000000000634'), 0, 'release decrements the seminar count');
select is((public.register_for_seminar('00000000-0000-4000-8000-000000000634')).status, 'released', 'registration after the confirmation close is immediately released');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select is((public.register_for_seminar('00000000-0000-4000-8000-000000000633')).status, 'registered', 'registration remains unconfirmed before its window opens');
reset role;
update public.seminars
set starts_at = now() + interval '12 hours',
    ends_at = now() + interval '14 hours',
    confirmation_opens_hours_before = 36,
    confirmation_closes_hours_before = 2
where id = '00000000-0000-4000-8000-000000000633';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select is((public.confirm_registration('00000000-0000-4000-8000-000000000633')).status, 'confirmed', 'student can confirm during the open window');
select ok((select confirmed_at is not null from public.registrations where seminar_id = '00000000-0000-4000-8000-000000000633' and student_user_id = auth.uid()), 'manual confirmation uses a server timestamp');
select is((public.confirm_registration('00000000-0000-4000-8000-000000000633')).status, 'confirmed', 'repeating confirmation is idempotent');
select throws_ok($$select public.confirm_registration('00000000-0000-4000-8000-000000000636')$$, 'P0001', 'not_available', 'cancelled seminar cannot accept confirmation');
select is((select status from public.registrations where id = '00000000-0000-4000-8000-000000000644'), 'registered', 'cancelled seminar confirmation attempt leaves registration unchanged');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000613","role":"authenticated"}', true);
set local role authenticated;
select is((public.publish_seminar('00000000-0000-4000-8000-000000000651')).publication_status, 'published', 'organization member can publish a ready draft');
select is((select published_seminar_id from public.seminar_drafts where id = '00000000-0000-4000-8000-000000000651'), (select id from public.seminars where title = 'Ready seminar'), 'publishing retains authoring data linked to the seminar');
select is((select required_attendance_percent from public.seminars where reference is not null and title = 'Ready seminar'), 60, 'new seminar uses the confirmed default attendance threshold');
select is((public.create_org_edit_draft((select id from public.seminars where title = 'Ready seminar'))).certificate_template ->> 'backgroundUrl', 'private/template.png', 'authorized seminar edit draft clones its certificate template');
select is((public.create_org_edit_draft((select id from public.seminars where title = 'Ready seminar'))).survey_definition #>> '{sections,0,questions,0,id}', 'q1', 'authorized seminar edit draft clones its survey definition');
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000652')$$, 'P0001', 'validation_failed', 'draft topics must be a JSON array');
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000653')$$, 'P0001', 'validation_failed', 'webinar publication requires an HTTPS join URL');
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000654')$$, 'P0001', 'validation_failed', 'seminar capacity cannot be reduced below active registrations');
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000655')$$, 'P0001', 'not_found', 'missing draft cannot be published');
select throws_ok($$select public.create_org_edit_draft('00000000-0000-4000-8000-000000000632')$$, 'P0001', 'not_found', 'organization user cannot create an edit draft outside its organization');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000614","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000651')$$, 'P0001', 'not_found', 'an adviser cannot publish an organization seminar');
select throws_ok($$select public.create_org_edit_draft((select published_seminar_id from public.seminar_drafts where id = '00000000-0000-4000-8000-000000000651'))$$, 'P0001', 'not_found', 'an adviser cannot create a seminar edit draft');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select is(public.get_webinar_join_url('00000000-0000-4000-8000-000000000637'), 'https://meet.example.test/private-session', 'confirmed student receives webinar link inside the join window');
select throws_ok($$select public.get_webinar_join_url('00000000-0000-4000-8000-000000000632')$$, 'P0001', 'not_available', 'seminar registrant cannot use webinar-link endpoint for a seminar');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.get_webinar_join_url('00000000-0000-4000-8000-000000000637')$$, 'P0001', 'not_available', 'unconfirmed student cannot receive webinar link');
reset role;

update public.seminars set starts_at = now() + interval '2 hours', ends_at = now() + interval '4 hours' where id = '00000000-0000-4000-8000-000000000637';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.get_webinar_join_url('00000000-0000-4000-8000-000000000637')$$, 'P0001', 'not_available', 'confirmed student cannot receive webinar link before its window');
reset role;
update public.seminars set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 minute' where id = '00000000-0000-4000-8000-000000000637';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.get_webinar_join_url('00000000-0000-4000-8000-000000000637')$$, 'P0001', 'not_available', 'confirmed student cannot receive webinar link after seminar end');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.publish_seminar('00000000-0000-4000-8000-000000000651')$$, 'P0001', 'not_found', 'unrelated student cannot discover or publish another organization draft');

select has_function('public', 'acknowledge_attendance', ARRAY['uuid'], 'attendance acknowledgement uses a database function');
select ok(has_function_privilege('anon', 'public.acknowledge_attendance(uuid)', 'EXECUTE') is false, 'anonymous users cannot acknowledge attendance');
select ok(has_function_privilege('authenticated', 'public.acknowledge_attendance(uuid)', 'EXECUTE'), 'authenticated students can call the acknowledgement function');
reset role;
update public.seminars set starts_at = now() - interval '30 minutes', ends_at = now() + interval '2 hours'
where id = '00000000-0000-4000-8000-000000000632';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.acknowledge_attendance('00000000-0000-4000-8000-000000000632')$$, 'confirmed student can acknowledge their attendance inside the prompt window');
select ok((select attendance_ack_at is not null from public.registrations where id = '00000000-0000-4000-8000-000000000643'), 'acknowledgement timestamp is persisted on the registration');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000613","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.acknowledge_attendance('00000000-0000-4000-8000-000000000632')$$, 'P0001', 'not_found', 'another student cannot acknowledge a registration they do not own');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
select throws_ok($$select public.acknowledge_attendance('00000000-0000-4000-8000-000000000634')$$, 'P0001', 'not_available', 'unconfirmed registration cannot acknowledge attendance');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000612","role":"authenticated"}', true);
reset role;
set local role authenticated;
select throws_ok($$select public.acknowledge_attendance('00000000-0000-4000-8000-000000000636')$$, 'P0001', 'not_available', 'cancelled seminar registration cannot acknowledge attendance');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000611","role":"authenticated"}', true);
select throws_ok($$select public.acknowledge_attendance('00000000-0000-4000-8000-000000000635')$$, 'P0001', 'not_available', 'prompt is unavailable before one hour before the seminar');
select has_function('public', 'get_server_time', ARRAY[]::text[], 'authoritative server time uses a database function');
select ok(has_function_privilege('anon', 'public.get_server_time()', 'EXECUTE'), 'anonymous users can read public-safe database time');
select ok(has_function_privilege('authenticated', 'public.get_server_time()', 'EXECUTE'), 'authenticated users can read database time');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select ok(public.get_server_time() is not null, 'anonymous server-time call returns a database timestamp');
reset role;

select * from finish();
rollback;
