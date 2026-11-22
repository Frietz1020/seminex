begin;
select plan(17);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000911@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000912@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000913', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '209000913@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

update public.profiles set first_name = 'Certificate', last_name = 'Recipient', display_name = 'Certificate Recipient'
where id = '00000000-0000-4000-8000-000000000911';
insert into public.organizations (id, slug, name)
values ('00000000-0000-4000-8000-000000000921', 'certificate-recovery-org', 'Certificate Recovery Org');
insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000912', 'org_member', 'active', 'Member', now());
insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by
) values (
  '00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000921', 'CERT-RECOVERY', 'Recovery Test', 'Description', 'seminar', 'Speaker', 'Hall',
  'CCS', now() - interval '1 day', now() - interval '23 hours', 2, 'published', now(), '00000000-0000-4000-8000-000000000912'
);
insert into public.seminar_drafts (id, organization_id, published_seminar_id, created_by, certificate_template, updated_at)
values (
  '00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000912',
  '{"backgroundUrl":"data:image/png;base64,AA==","nameBox":{"x":1}}', now()
);
insert into public.registrations (id, seminar_id, student_user_id, status, confirmed_at)
values ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000911', 'confirmed', now());
insert into public.certificate_issuances (
  id, seminar_id, registration_id, student_user_id, serial, template_snapshot, status, object_path, issued_at
) values (
  '00000000-0000-4000-8000-000000000961', '00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000911', 'SNX-KEEP-ME', '{}', 'issued',
  '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951.pdf', now()
);
insert into storage.objects (bucket_id, name)
values ('certificates', '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951/00000000-0000-4000-8000-000000000971.pdf');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000912","role":"authenticated"}', true);
set local role authenticated;
select is(
  public.get_certificate_regeneration_input('00000000-0000-4000-8000-000000000951')->>'serial',
  'SNX-KEEP-ME', 'an active organization member receives the issued certificate inputs'
);
select is(
  public.get_certificate_regeneration_input('00000000-0000-4000-8000-000000000951')->>'studentName',
  'Certificate Recipient', 'regeneration input includes the resolved recipient name'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000911","role":"authenticated"}', true);
set local role authenticated;
select is(auth.uid()::text, '00000000-0000-4000-8000-000000000911', 'applicant JWT identifies the applicant user');
select is((select count(*)::integer from public.organization_memberships where user_id = auth.uid()), 0, 'applicant has no organization membership');
select throws_ok(
  $$select public.get_certificate_regeneration_input('00000000-0000-4000-8000-000000000951')$$,
  'P0001', 'not_found', 'applicants cannot use the organization regeneration input'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000913","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.get_certificate_regeneration_input('00000000-0000-4000-8000-000000000951')$$,
  'P0001', 'not_found', 'non-members cannot read regeneration inputs'
);
reset role;

select ok(not has_function_privilege('authenticated', 'public.finalize_certificate_regeneration(uuid,uuid,text,text,uuid)', 'execute'), 'authenticated users cannot finalize replacements');
select ok(has_function_privilege('service_role', 'public.finalize_certificate_regeneration(uuid,uuid,text,text,uuid)', 'execute'), 'service role can finalize replacements');
select ok(not has_table_privilege('authenticated', 'public.certificate_regeneration_audit', 'select'), 'authenticated users cannot read regeneration audit rows');

set local role service_role;
select throws_ok(
  $$select public.finalize_certificate_regeneration(
    '00000000-0000-4000-8000-000000000951',
    '00000000-0000-4000-8000-000000000912',
    '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951.pdf',
    '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951/00000000-0000-4000-8000-000000000973.pdf',
    '00000000-0000-4000-8000-000000000973'
  )$$,
  'P0001', 'not_available', 'finalization rejects a new path with no uploaded Storage object'
);
reset role;
select is((select object_path from public.certificate_issuances where id = '00000000-0000-4000-8000-000000000961'), '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951.pdf', 'missing-object rejection preserves the old issued PDF');
select is((select count(*)::integer from public.certificate_regeneration_audit), 0, 'missing-object rejection writes no audit row');

set local role service_role;
select lives_ok(
  $$select public.finalize_certificate_regeneration(
    '00000000-0000-4000-8000-000000000951',
    '00000000-0000-4000-8000-000000000912',
    '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951.pdf',
    '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951/00000000-0000-4000-8000-000000000971.pdf',
    '00000000-0000-4000-8000-000000000971'
  )$$,
  'service role finalization swaps the object only after a new object exists'
);
reset role;
select is((select object_path from public.certificate_issuances where id = '00000000-0000-4000-8000-000000000961'), '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951/00000000-0000-4000-8000-000000000971.pdf', 'replacement path becomes active');
select is((select serial from public.certificate_issuances where id = '00000000-0000-4000-8000-000000000961'), 'SNX-KEEP-ME', 'replacement keeps issuance serial stable');
select is((select count(*)::integer from public.certificate_regeneration_audit where request_id = '00000000-0000-4000-8000-000000000971'), 1, 'finalization writes one audit event');
set local role service_role;
select throws_ok(
  $$select public.finalize_certificate_regeneration(
    '00000000-0000-4000-8000-000000000951',
    '00000000-0000-4000-8000-000000000912',
    'stale/path.pdf',
    '00000000-0000-4000-8000-000000000931/00000000-0000-4000-8000-000000000951/00000000-0000-4000-8000-000000000972.pdf',
    '00000000-0000-4000-8000-000000000972'
  )$$,
  'P0001', 'conflict', 'a stale expected object path cannot overwrite the latest replacement'
);
reset role;

select * from finish();
rollback;
