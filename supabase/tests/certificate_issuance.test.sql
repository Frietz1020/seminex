begin;

select plan(11);

select has_table('public', 'certificate_issuances', 'certificate issuance has a database record');
select has_column('public', 'certificate_issuances', 'registration_id', 'each issuance belongs to one registration');
select has_column('public', 'certificate_issuances', 'serial', 'certificate serial is persisted by the server');
select has_column('public', 'certificate_issuances', 'template_snapshot', 'issuance retains the template used to render it');
select has_column('public', 'certificate_issuances', 'object_path', 'issued file is stored by private object path');
select has_function('public', 'get_org_seminar_certificates', array['uuid'], 'organization certificate reads use an authorized database function');
select has_function('public', 'get_my_certificate', array['uuid'], 'student certificate reads use an authorized database function');
select ok(not coalesce(has_table_privilege('authenticated', to_regclass('public.certificate_issuances'), 'INSERT'), false), 'authenticated users cannot insert certificate issuance rows directly');
select ok(not coalesce(has_function_privilege('authenticated', to_regprocedure('public.finalize_certificate_issuance(uuid,text)'), 'EXECUTE'), false), 'authenticated users cannot finalize certificate storage state');
select is((select public from storage.buckets where id = 'certificates'), false, 'certificate storage bucket is private');
select ok(exists (
  select 1 from pg_catalog.pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Students and active organization members can read issued certificates'
), 'storage reads use the recipient and active organization authorization policy');

select * from finish();
rollback;
