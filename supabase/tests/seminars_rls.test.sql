begin;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000511@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000512@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000513', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000513@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000514', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000514@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, slug, name)
values
  ('00000000-0000-4000-8000-000000000521', 'seminar-rls-ccs', 'Seminar RLS CCS'),
  ('00000000-0000-4000-8000-000000000522', 'seminar-rls-cba', 'Seminar RLS CBA');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000511', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000512', 'adviser', 'active', null, null),
  ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000513', 'org_member', 'active', 'Member', now());

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type,
  speaker_name, department, starts_at, ends_at, capacity, publication_status,
  venue, published_at, join_url, created_by
)
values
  ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000521', 'RLS-PUBLIC', 'Published CCS Seminar', 'Visible listing', 'seminar', 'Speaker CCS', 'CCS', now() + interval '2 days', now() + interval '2 days 2 hours', 20, 'published', 'Forum 101', now(), null, '00000000-0000-4000-8000-000000000511'),
  ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000521', 'RLS-DRAFT', 'Draft CCS Seminar', 'Private draft', 'seminar', 'Speaker CCS', 'CCS', now() + interval '3 days', now() + interval '3 days 2 hours', 20, 'draft', 'Forum 101', null, null, '00000000-0000-4000-8000-000000000511'),
  ('00000000-0000-4000-8000-000000000533', '00000000-0000-4000-8000-000000000522', 'RLS-OTHER', 'Published Other Seminar', 'Visible listing', 'webinar', 'Speaker CBA', 'CBA', now() + interval '4 days', now() + interval '4 days 2 hours', 20, 'published', '', now(), 'https://meet.example.test/private', '00000000-0000-4000-8000-000000000513');

insert into public.seminar_drafts (id, organization_id, created_by, details)
values
  ('00000000-0000-4000-8000-000000000541', '00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000511', '{"title":"CCS draft"}'),
  ('00000000-0000-4000-8000-000000000542', '00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000513', '{"title":"CBA draft"}');

insert into public.registrations (id, seminar_id, student_user_id)
values
  ('00000000-0000-4000-8000-000000000551', '00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000511'),
  ('00000000-0000-4000-8000-000000000552', '00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000513'),
  ('00000000-0000-4000-8000-000000000553', '00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000514');

select has_table('public', 'seminars', 'seminars are persisted');
select has_table('public', 'seminar_drafts', 'organization seminar drafts are persisted');
select has_table('public', 'registrations', 'student seminar registrations are persisted');
select has_column('public', 'seminars', 'required_attendance_percent', 'attendance threshold is stored per seminar');
select has_column('public', 'seminars', 'join_url', 'webinar links are stored for restricted access');
select ok(has_column_privilege('anon', 'public.seminars', 'join_url', 'SELECT') is false, 'anonymous catalog readers cannot select webinar links');
select ok(has_column_privilege('authenticated', 'public.seminars', 'join_url', 'SELECT') is false, 'authenticated direct table readers cannot select webinar links');

set local role anon;
select is((select count(*)::integer from public.seminars where id in ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000533')), 2, 'anonymous users see only published test seminars');
select throws_ok($$select count(*) from public.seminar_drafts$$, '42501', null, 'anonymous users cannot read organization drafts');
select throws_ok($$select count(*) from public.registrations$$, '42501', null, 'anonymous users cannot read registration rosters');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000514","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.seminars where id in ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000533')), 2, 'a participant sees published test catalog rows');
select is((select count(*)::integer from public.seminar_drafts), 0, 'a participant cannot read organization drafts');
select is((select count(*)::integer from public.registrations), 1, 'a student reads only their own registration');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000511","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.seminars where id in ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000533')), 3, 'an organization member sees published test rows and seminars in their organization');
select is((select count(*)::integer from public.seminar_drafts), 1, 'an organization member sees only their organization draft');
select is((select count(*)::integer from public.registrations), 3, 'an organization member can read the roster for their organization and their own registrations');
select lives_ok($$insert into public.seminar_drafts (organization_id, created_by, details) values ('00000000-0000-4000-8000-000000000521', auth.uid(), '{"title":"Member draft"}')$$, 'an organization member can create a draft for their organization');
select throws_ok($$insert into public.seminar_drafts (organization_id, created_by, details) values ('00000000-0000-4000-8000-000000000522', auth.uid(), '{"title":"Foreign draft"}')$$, '42501', null, 'an organization member cannot create a draft for another organization');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000512","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.seminar_drafts), 2, 'an adviser sees drafts only for their organization');
select lives_ok($$update public.seminar_drafts set details = '{"title":"Adviser edit"}' where id = '00000000-0000-4000-8000-000000000541'$$, 'an adviser draft update is safely filtered by row-level security');
select is((select details ->> 'title' from public.seminar_drafts where id = '00000000-0000-4000-8000-000000000541'), 'CCS draft', 'an adviser cannot edit an organization seminar draft');
select throws_ok($$insert into public.seminar_drafts (organization_id, created_by, details) values ('00000000-0000-4000-8000-000000000521', auth.uid(), '{"title":"Adviser draft"}')$$, '42501', null, 'an adviser cannot create an organization seminar draft');
select lives_ok($$delete from public.seminar_drafts where id = '00000000-0000-4000-8000-000000000541'$$, 'an adviser draft delete is safely filtered by row-level security');
select is((select count(*)::integer from public.seminar_drafts where id = '00000000-0000-4000-8000-000000000541'), 1, 'an adviser cannot delete an organization seminar draft');
select is((select count(*)::integer from public.registrations), 3, 'an adviser reads the roster for their organization and their own registrations');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000513","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.seminar_drafts), 1, 'a different organization member cannot read another organization draft');
select is((select count(*)::integer from public.registrations), 1, 'a different organization member cannot read another organization roster');
select lives_ok($$update public.seminar_drafts set details = '{"title":"Own edit"}' where id = '00000000-0000-4000-8000-000000000542'$$, 'an organization member can update their own organization draft');

select * from finish();
rollback;
