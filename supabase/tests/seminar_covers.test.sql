begin;

select plan(13);

select is((select public from storage.buckets where id = 'seminar-covers'), true, 'seminar cover bucket is public');
select is((select file_size_limit::integer from storage.buckets where id = 'seminar-covers'), 5242880, 'seminar cover bucket limits files to 5 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'seminar-covers'), array['image/png', 'image/jpeg', 'image/webp'], 'seminar cover bucket accepts only PNG, JPEG, and WebP');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000811', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '208000811@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000812', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '208000812@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000813', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '208000813@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000814', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '208000814@gordoncollege.edu.ph', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, slug, name)
values
  ('00000000-0000-4000-8000-000000000821', 'seminar-covers-owner', 'Seminar Covers Owner'),
  ('00000000-0000-4000-8000-000000000822', 'seminar-covers-other', 'Seminar Covers Other');

insert into public.organization_memberships (organization_id, user_id, role, status, position, appointed_at)
values
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', 'org_member', 'active', 'Member', now()),
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000812', 'adviser', 'active', null, null),
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000813', 'org_member', 'removed', 'Member', now()),
  ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000814', 'org_member', 'active', 'Member', now());

insert into public.seminars (
  id, organization_id, reference, title, description, seminar_type, speaker_name, venue,
  department, starts_at, ends_at, capacity, publication_status, published_at, created_by
)
values (
  '00000000-0000-4000-8000-000000000831', '00000000-0000-4000-8000-000000000821',
  'COVER-ISSUED', 'Published Cover Seminar', 'Cover policy test', 'seminar', 'Speaker',
  'Hall', 'CCS', now() + interval '1 day', now() + interval '1 day 2 hours', 5,
  'published', now(), '00000000-0000-4000-8000-000000000811'
);

insert into public.seminar_drafts (id, organization_id, created_by, details, published_seminar_id)
values
  ('00000000-0000-4000-8000-000000000841', '00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', '{}', null),
  ('00000000-0000-4000-8000-000000000842', '00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000814', '{}', null),
  ('00000000-0000-4000-8000-000000000843', '00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', '{}', '00000000-0000-4000-8000-000000000831');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000811","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000841/00000000-0000-4000-8000-000000000851.png')$$,
  'an active organization member can upload under their unpublished draft'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000822/00000000-0000-4000-8000-000000000842/00000000-0000-4000-8000-000000000852.png')$$,
  '42501', null, 'an officer cannot upload under another organization'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000843/00000000-0000-4000-8000-000000000853.png')$$,
  '42501', null, 'an officer cannot upload to a published draft'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000841/00000000-0000-4000-8000-000000000854.svg')$$,
  '42501', null, 'an officer cannot upload an unsupported object extension'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000812","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000841/00000000-0000-4000-8000-000000000855.png')$$,
  '42501', null, 'an adviser cannot upload seminar covers'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000813","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('seminar-covers', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000841/00000000-0000-4000-8000-000000000856.png')$$,
  '42501', null, 'a removed organization member cannot upload seminar covers'
);
reset role;

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Organization officers upload seminar covers'
    and cmd = 'INSERT' and roles @> array['authenticated']::name[]
    and with_check like '%seminar-covers%'
    and with_check like '%organization_memberships%'
    and with_check like '%org_member%'
    and with_check like '%seminar_drafts%'
    and with_check like '%published_seminar_id%'
), 'upload policy requires active organization officer and unpublished draft');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Organization officers delete seminar covers'
    and cmd = 'DELETE' and roles @> array['authenticated']::name[]
    and qual like '%seminar-covers%'
    and qual like '%organization_memberships%'
    and qual like '%org_member%'
    and qual like '%seminar_drafts%'
    and qual like '%published_seminar_id%'
), 'delete policy requires active organization officer and unpublished draft');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'UPDATE' and with_check like '%seminar-covers%'), 0, 'cover objects cannot be overwritten through Storage update');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and qual like '%seminar-covers%'), 0, 'public cover reads use only the public bucket behavior');

select * from finish();
rollback;
