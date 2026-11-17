begin;

select plan(31);

select has_column('public', 'profiles', 'first_name', 'profiles stores first names');
select has_column('public', 'profiles', 'last_name', 'profiles stores last names');
select has_column('public', 'profiles', 'middle_initial', 'profiles stores middle initials');
select has_column('public', 'profiles', 'program', 'profiles stores program values');
select has_column('public', 'profiles', 'year_level', 'profiles stores year levels');
select has_column('public', 'profiles', 'block', 'profiles stores block values');
select has_table('public', 'organization_access_requests', 'pending organization access requests have a table');
select has_function(
  'public',
  'complete_org_signup',
  ARRAY['text', 'text', 'text', 'text', 'smallint', 'text', 'uuid', 'text', 'text'],
  'organization signup has an atomic completion function'
);
select ok(has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE'), 'authenticated users can update their own profile fields');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000001@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adviser@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '205000003@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

select throws_ok($$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ('00000000-0000-4000-8000-000000000404', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outside@example.com', '', now(), '{}', '{}', now(), now())$$, '23514', null, 'accounts must use a college email address');

insert into public.organizations (id, slug, name)
values
  ('00000000-0000-4000-8000-000000000411', 'rls-test-ccs', 'RLS Test CCS'),
  ('00000000-0000-4000-8000-000000000412', 'rls-test-cba', 'RLS Test CBA');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000402', 'adviser', 'active', null, null);

set local role anon;
select is((select count(*)::integer from public.organizations where id in ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000412')), 2, 'the public signup catalog lists both test organizations');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.profiles), 1, 'a participant reads their own profile');
select is((select student_id from public.profiles where id = '00000000-0000-4000-8000-000000000401'), '205000001', 'the auth trigger derives the institutional student ID');
select is((select student_id from public.profiles where id = '00000000-0000-4000-8000-000000000402'), null, 'faculty email profiles are not assigned a student ID');
select is((select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-000000000402'), 0, 'a participant cannot read another profile');
select is((select count(*)::integer from public.organization_memberships), 1, 'a user reads only their own memberships');
select is((select count(*)::integer from public.organizations where id in ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000412')), 2, 'an active member can read the public organization catalog');
select is((select count(*)::integer from public.organization_memberships where user_id = '00000000-0000-4000-8000-000000000402'), 0, 'an org member cannot read another users membership');
select lives_ok($$update public.profiles set display_name = 'Local Test' where id = '00000000-0000-4000-8000-000000000401'$$, 'a participant can update their display name');
select throws_ok($$update public.profiles set email = '205000009@gordoncollege.edu.ph' where id = '00000000-0000-4000-8000-000000000401'$$, '42501', null, 'a participant cannot change their identity email');
select throws_ok($$update public.organization_memberships set role = 'adviser' where organization_id = '00000000-0000-4000-8000-000000000411'$$, '42501', null, 'a member cannot promote their organization role');
select lives_ok($$select public.complete_org_signup('Test'::text, 'Student'::text, ''::text, 'CS'::text, 2::smallint, 'A'::text, '00000000-0000-4000-8000-000000000411'::uuid, 'Secretary'::text, 'I help organize events'::text)$$, 'organization signup updates the profile and creates its request');
select is((select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000401'), 'Test', 'organization signup writes profile fields');
select is((select count(*)::integer from public.organization_access_requests where user_id = '00000000-0000-4000-8000-000000000401' and status = 'pending'), 1, 'organization signup creates one pending access request');
select throws_ok($$insert into public.organization_access_requests (organization_id, user_id, position) values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'Treasurer')$$, '23505', null, 'a participant cannot create duplicate pending requests for one organization');
select throws_ok($$insert into public.organization_access_requests (organization_id, user_id, position) values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000402', 'Secretary')$$, '42501', null, 'a user cannot create an access request for another user');
select lives_ok($$delete from public.organization_access_requests where user_id = '00000000-0000-4000-8000-000000000401' and status = 'pending'$$, 'a participant can withdraw their own pending request');
select is((select count(*)::integer from public.organization_access_requests where user_id = '00000000-0000-4000-8000-000000000401'), 0, 'withdrawal removes the pending request');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000403","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.organization_memberships), 0, 'a participant without membership cannot read organization memberships');
select throws_ok($$insert into public.organization_access_requests (organization_id, user_id, position) values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000403', 'Secretary')$$, '42501', null, 'an incomplete account cannot request organization access directly');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.organizations where id in ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000412')), 2, 'an adviser can read the public organization catalog');

select * from finish();
rollback;
