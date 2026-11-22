create table public.certificate_regeneration_audit (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null references public.certificate_issuances(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null unique,
  previous_object_path text not null,
  new_object_path text not null unique,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint certificate_regeneration_paths_differ check (previous_object_path <> new_object_path)
);

alter table public.certificate_regeneration_audit enable row level security;
revoke all on public.certificate_regeneration_audit from public, anon, authenticated;
grant all on public.certificate_regeneration_audit to service_role;

create function public.get_certificate_regeneration_input(p_registration_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_input jsonb;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select pg_catalog.jsonb_build_object(
    'registrationId', issuance.registration_id,
    'seminarId', issuance.seminar_id,
    'serial', issuance.serial,
    'status', issuance.status,
    'objectPath', issuance.object_path,
    'template', draft.certificate_template,
    'seminarTitle', seminar.title,
    'studentName', coalesce(
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(
        ' ',
        nullif(pg_catalog.btrim(profile.first_name), ''),
        nullif(pg_catalog.btrim(profile.middle_initial), ''),
        nullif(pg_catalog.btrim(profile.last_name), '')
      )), ''),
      profile.display_name,
      profile.student_id
    )
  ) into v_input
  from public.certificate_issuances as issuance
  join public.seminars as seminar on seminar.id = issuance.seminar_id
  join public.profiles as profile on profile.id = issuance.student_user_id
  join public.organization_memberships as membership
    on membership.organization_id = seminar.organization_id
   and membership.user_id = v_uid
   and membership.status = 'active'
  join lateral (
    select candidate.certificate_template
    from public.seminar_drafts as candidate
    where candidate.published_seminar_id = seminar.id
      and candidate.certificate_template is not null
    order by candidate.updated_at desc, candidate.id
    limit 1
  ) as draft on true
  where issuance.registration_id = p_registration_id
    and issuance.status = 'issued';

  if v_input is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  return v_input;
end;
$$;
revoke all on function public.get_certificate_regeneration_input(uuid) from public, anon;
grant execute on function public.get_certificate_regeneration_input(uuid) to authenticated;

create function public.finalize_certificate_regeneration(
  p_registration_id uuid,
  p_actor_user_id uuid,
  p_expected_object_path text,
  p_new_object_path text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issuance public.certificate_issuances;
begin
  if p_registration_id is null or p_actor_user_id is null or p_request_id is null
    or p_expected_object_path is null or p_new_object_path is null
    or p_new_object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  select issuance.* into v_issuance
  from public.certificate_issuances as issuance
  where issuance.registration_id = p_registration_id
  for update;
  if not found or v_issuance.status <> 'issued' then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_issuance.object_path <> p_expected_object_path then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  if p_new_object_path <> v_issuance.seminar_id::text || '/' || v_issuance.registration_id::text || '/' || p_request_id::text || '.pdf' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  if not exists (
    select 1 from public.organization_memberships membership
    join public.seminars seminar on seminar.organization_id = membership.organization_id
    where seminar.id = v_issuance.seminar_id
      and membership.user_id = p_actor_user_id
      and membership.status = 'active'
  ) then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'certificates' and object.name = p_new_object_path
  ) then raise exception using errcode = 'P0001', message = 'not_available'; end if;

  update public.certificate_issuances as issuance
  set object_path = p_new_object_path, updated_at = pg_catalog.clock_timestamp()
  where issuance.id = v_issuance.id
  returning * into v_issuance;

  insert into public.certificate_regeneration_audit (
    issuance_id, registration_id, actor_user_id, request_id, previous_object_path, new_object_path
  ) values (
    v_issuance.id, v_issuance.registration_id, p_actor_user_id, p_request_id,
    p_expected_object_path, p_new_object_path
  );

  return pg_catalog.jsonb_build_object('serial', v_issuance.serial, 'objectPath', v_issuance.object_path);
end;
$$;
revoke all on function public.finalize_certificate_regeneration(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.finalize_certificate_regeneration(uuid, uuid, text, text, uuid) to service_role;
