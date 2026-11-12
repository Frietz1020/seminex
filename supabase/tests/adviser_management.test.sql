begin;
select no_plan();

select has_column('public', 'organization_memberships', 'id', 'memberships expose stable UUIDs');
select has_column('public', 'organization_memberships', 'position', 'memberships store current positions');
select has_column('public', 'organization_memberships', 'appointed_at', 'memberships store appointment times');
select has_column('public', 'organization_memberships', 'endorsed_by', 'memberships store endorsing advisers');

select has_function('public', 'list_adviser_org_requests', ARRAY[]::text[], 'adviser request-list RPC exists');
select has_function('public', 'list_adviser_org_members', ARRAY[]::text[], 'adviser member-list RPC exists');
select ok(to_regprocedure('public.decide_adviser_org_request(uuid,text,text)') is not null, 'adviser decision RPC exists');
select ok(to_regprocedure('public.update_adviser_member_position(uuid,text)') is not null, 'adviser position RPC exists');
select ok(to_regprocedure('public.remove_adviser_member(uuid)') is not null, 'adviser removal RPC exists');

select ok(
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.list_adviser_org_requests()'), 'EXECUTE'), false),
  'authenticated users can execute the adviser request-list RPC'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.list_adviser_org_requests()'), 'EXECUTE'), false),
  'anonymous users cannot execute the adviser request-list RPC'
);
select ok(coalesce(has_function_privilege('authenticated', to_regprocedure('public.list_adviser_org_members()'), 'EXECUTE'), false), 'authenticated users can execute the adviser member-list RPC');
select ok(not coalesce(has_function_privilege('anon', to_regprocedure('public.list_adviser_org_members()'), 'EXECUTE'), false), 'anonymous users cannot execute the adviser member-list RPC');
select ok(coalesce(has_function_privilege('authenticated', to_regprocedure('public.decide_adviser_org_request(uuid,text,text)'), 'EXECUTE'), false), 'authenticated users can execute the adviser decision RPC');
select ok(not coalesce(has_function_privilege('anon', to_regprocedure('public.decide_adviser_org_request(uuid,text,text)'), 'EXECUTE'), false), 'anonymous users cannot execute the adviser decision RPC');
select ok(coalesce(has_function_privilege('authenticated', to_regprocedure('public.update_adviser_member_position(uuid,text)'), 'EXECUTE'), false), 'authenticated users can execute the adviser position RPC');
select ok(not coalesce(has_function_privilege('anon', to_regprocedure('public.update_adviser_member_position(uuid,text)'), 'EXECUTE'), false), 'anonymous users cannot execute the adviser position RPC');
select ok(coalesce(has_function_privilege('authenticated', to_regprocedure('public.remove_adviser_member(uuid)'), 'EXECUTE'), false), 'authenticated users can execute the adviser removal RPC');
select ok(not coalesce(has_function_privilege('anon', to_regprocedure('public.remove_adviser_member(uuid)'), 'EXECUTE'), false), 'anonymous users cannot execute the adviser removal RPC');
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001001@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001002@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001003@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001004@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001005@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001006@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001007@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001008@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000001009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209001009@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

update public.profiles
set first_name = 'Test', last_name = 'User'
where id between '00000000-0000-4000-8000-000000001001'::uuid and '00000000-0000-4000-8000-000000001009'::uuid;

insert into public.organizations (id, slug, name, department)
values
  ('00000000-0000-4000-8000-000000001101', 'adviser-test-org-a', 'Adviser Test Organization A', 'CCS'),
  ('00000000-0000-4000-8000-000000001102', 'adviser-test-org-b', 'Adviser Test Organization B', 'CCS');

insert into public.organization_memberships (
  id, organization_id, user_id, role, status, position, created_at, appointed_at, endorsed_by
)
values
  ('00000000-0000-4000-8000-000000001201', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001001', 'adviser', 'active', null, now() - interval '200 days', null, null),
  ('00000000-0000-4000-8000-000000001202', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001003', 'org_member', 'removed', 'Former Secretary', now() - interval '100 days', now() - interval '100 days', '00000000-0000-4000-8000-000000001001'),
  ('00000000-0000-4000-8000-000000001203', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001005', 'org_member', 'active', 'Treasurer', now() - interval '90 days', now() - interval '90 days', '00000000-0000-4000-8000-000000001001'),
  ('00000000-0000-4000-8000-000000001204', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001007', 'adviser', 'active', null, now() - interval '180 days', null, null),
  ('00000000-0000-4000-8000-000000001205', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000001002', 'adviser', 'active', null, now() - interval '180 days', null, null),
  ('00000000-0000-4000-8000-000000001206', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000001009', 'adviser', 'removed', null, now() - interval '180 days', null, null);

insert into public.organization_access_requests (
  id, organization_id, user_id, position, statement, status, requested_at
)
values
  ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001003', 'Assistant Secretary', 'Reactivation request', 'pending', now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-000000001302', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001004', repeat('x', 120), null, 'pending', now() - interval '4 minutes'),
  ('00000000-0000-4000-8000-000000001303', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001005', 'President', null, 'pending', now() - interval '3 minutes'),
  ('00000000-0000-4000-8000-000000001304', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001007', 'Secretary', null, 'pending', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-000000001305', '00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001008', 'Representative', null, 'pending', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000001306', '00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000001006', 'Secretary', null, 'pending', now());

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001001","role":"authenticated"}', true);
set local role authenticated;

select is(jsonb_array_length(public.list_adviser_org_requests()), 5, 'adviser sees requests only from assigned organizations');
select is(public.list_adviser_org_requests()->0->>'id', '00000000-0000-4000-8000-000000001305', 'adviser requests are ordered newest first');
select is(jsonb_array_length(public.list_adviser_org_members()), 4, 'directory includes assigned-organization members and advisers');
select is(public.list_adviser_org_members()->0->>'organizationId', '00000000-0000-4000-8000-000000001101', 'directory rows identify their organization');
select is((select count(*)::integer from jsonb_array_elements(public.list_adviser_org_members()) as item where item->>'status' = 'removed'), 1, 'directory retains removed membership history');
select is((select count(*)::integer from jsonb_array_elements(public.list_adviser_org_members()) as item where item->>'category' = 'adviser' and item->>'position' = 'Faculty adviser'), 2, 'adviser directory rows are read-only and labeled Faculty adviser');

select throws_ok(
  $$select public.decide_adviser_org_request('00000000-0000-4000-8000-000000001306', 'approved', null)$$,
  'P0001', 'not_found', 'adviser cannot decide a request outside assigned organizations'
);
select throws_ok(
  $$select public.update_adviser_member_position('00000000-0000-4000-8000-000000001205', 'President')$$,
  'P0001', 'not_found', 'adviser cannot discover a membership outside assigned organizations'
);
select throws_ok(
  $$select public.decide_adviser_org_request('00000000-0000-4000-8000-000000001303', 'approved', null)$$,
  'P0001', 'conflict', 'approval cannot overwrite an active member'
);
select is((select status::text from public.organization_access_requests where id = '00000000-0000-4000-8000-000000001303'), 'pending', 'active-member conflict leaves the request pending');
select throws_ok(
  $$select public.decide_adviser_org_request('00000000-0000-4000-8000-000000001304', 'approved', null)$$,
  'P0001', 'conflict', 'approval cannot convert an adviser membership into a member'
);
select is((select status::text from public.organization_access_requests where id = '00000000-0000-4000-8000-000000001304'), 'pending', 'adviser-membership conflict leaves the request pending');
select throws_ok(
  $$select public.decide_adviser_org_request('00000000-0000-4000-8000-000000001305', 'unknown', null)$$,
  'P0001', 'validation_failed', 'unsupported request decisions are rejected'
);

select is(
  public.decide_adviser_org_request('00000000-0000-4000-8000-000000001301', 'approved', null)->>'status',
  'approved', 'approval records the request decision'
);
reset role;
select is((select id from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001003'), '00000000-0000-4000-8000-000000001202'::uuid, 'reactivation preserves the membership UUID');
select is((select status::text from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001003'), 'active', 'approval reactivates a removed membership');
select is((select position from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001003'), 'Assistant Secretary', 'reactivation saves the requested position');
select is((select endorsed_by from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001003'), '00000000-0000-4000-8000-000000001001'::uuid, 'reactivation records the authenticated adviser');
select ok((select appointed_at > now() - interval '1 minute' from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001003'), 'reactivation refreshes the appointment timestamp');
set local role authenticated;

select is(
  public.decide_adviser_org_request('00000000-0000-4000-8000-000000001302', 'approved', '  Verified  ')->>'status',
  'approved', 'approval creates a new member'
);
reset role;
select is((select count(*)::integer from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001004' and role = 'org_member' and status = 'active'), 1, 'approval creates exactly one active member row');
select is((select pg_catalog.char_length(position)::integer from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001004'), 120, 'approval accepts the existing 120-character request limit');
select is((select decision_note from public.organization_access_requests where id = '00000000-0000-4000-8000-000000001302'), 'Verified', 'decision notes are trimmed');
set local role authenticated;

select is(
  public.decide_adviser_org_request('00000000-0000-4000-8000-000000001305', 'rejected', null)->>'status',
  'rejected', 'rejection records the request decision'
);
select is((select count(*)::integer from public.organization_memberships where organization_id = '00000000-0000-4000-8000-000000001101' and user_id = '00000000-0000-4000-8000-000000001008'), 0, 'rejection does not create membership');

select is(pg_catalog.char_length(public.update_adviser_member_position('00000000-0000-4000-8000-000000001203', repeat('x', 100))->>'position'), 100, 'position updates accept exactly 100 characters');
select is(
  public.update_adviser_member_position('00000000-0000-4000-8000-000000001203', '  President  ')->>'position',
  'President', 'position updates trim and return the current position'
);
reset role;
select is((select position from public.organization_memberships where id = '00000000-0000-4000-8000-000000001203'), 'President', 'position update persists to the membership');
set local role authenticated;
select throws_ok(
  $$select public.update_adviser_member_position('00000000-0000-4000-8000-000000001203', '   ')$$,
  'P0001', 'validation_failed', 'empty position is rejected'
);
select throws_ok(
  $$select public.update_adviser_member_position('00000000-0000-4000-8000-000000001203', repeat('x', 101))$$,
  'P0001', 'validation_failed', 'position over 100 characters is rejected'
);

select is(
  public.remove_adviser_member('00000000-0000-4000-8000-000000001203')->>'status',
  'removed', 'removal returns the updated membership'
);
reset role;
select is((select count(*)::integer from public.organization_memberships where id = '00000000-0000-4000-8000-000000001203'), 1, 'removal retains membership history');
set local role authenticated;
select throws_ok(
  $$select public.update_adviser_member_position('00000000-0000-4000-8000-000000001203', 'President')$$,
  'P0001', 'conflict', 'removed members cannot be edited'
);

select throws_ok(
  $$update public.organization_memberships set role = 'adviser' where id = '00000000-0000-4000-8000-000000001203'$$,
  '42501', null, 'authenticated advisers cannot write membership rows directly'
);
select throws_ok(
  $$update public.organization_access_requests set status = 'approved' where id = '00000000-0000-4000-8000-000000001305'$$,
  '42501', null, 'authenticated advisers cannot write request decisions directly'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.list_adviser_org_requests()$$, 'P0001', 'forbidden', 'ordinary members cannot read adviser queues');
select throws_ok($$select public.list_adviser_org_members()$$, 'P0001', 'forbidden', 'ordinary members cannot read adviser directories');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001009","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.list_adviser_org_requests()$$, 'P0001', 'forbidden', 'removed advisers cannot read adviser queues');
select throws_ok($$select public.list_adviser_org_members()$$, 'P0001', 'forbidden', 'removed advisers cannot read adviser directories');

reset role;
select * from finish();
rollback;
