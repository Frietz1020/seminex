create table public.certificate_issuances (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  registration_id uuid not null unique references public.registrations (id) on delete restrict,
  student_user_id uuid not null references public.profiles (id) on delete restrict,
  serial text not null unique,
  template_snapshot jsonb not null check (jsonb_typeof(template_snapshot) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'issued')),
  object_path text unique,
  issued_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint certificate_issuance_status_file_check check (
    (status = 'pending' and object_path is null and issued_at is null)
    or (status = 'issued' and object_path is not null and issued_at is not null)
  )
);

create index certificate_issuances_seminar_created_idx
  on public.certificate_issuances (seminar_id, created_at, id);
create index certificate_issuances_student_seminar_idx
  on public.certificate_issuances (student_user_id, seminar_id);

alter table public.certificate_issuances enable row level security;
revoke all on public.certificate_issuances from public, anon, authenticated;
grant select on public.certificate_issuances to authenticated;

create policy "Students and active organization members can read certificate issuances"
  on public.certificate_issuances for select to authenticated
  using (
    student_user_id = (select auth.uid())
    or exists (
      select 1
      from public.seminars seminar
      join public.organization_memberships membership on membership.organization_id = seminar.organization_id
      where seminar.id = certificate_issuances.seminar_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('certificates', 'certificates', false, array['application/pdf'])
on conflict (id) do update set public = false, allowed_mime_types = array['application/pdf'];

create policy "Students and active organization members can read issued certificates"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'certificates'
    and exists (
      select 1
      from public.certificate_issuances issuance
      where issuance.object_path = storage.objects.name
        and issuance.status = 'issued'
        and (
          issuance.student_user_id = (select auth.uid())
          or exists (
            select 1
            from public.seminars seminar
            join public.organization_memberships membership on membership.organization_id = seminar.organization_id
            where seminar.id = issuance.seminar_id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
          )
        )
    )
  );

create function private.create_certificate_issuance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration public.registrations;
  v_template jsonb;
  v_serial text;
begin
  select registration.* into v_registration
  from public.registrations as registration
  where registration.id = new.registration_id
    and registration.seminar_id = new.seminar_id
    and registration.student_user_id = new.student_user_id
    and private.is_evaluation_eligible(registration.id, new.submitted_at);
  if not found then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  select draft.certificate_template into v_template
  from public.seminar_drafts as draft
  where draft.published_seminar_id = new.seminar_id
    and draft.certificate_template is not null
  order by draft.updated_at desc, draft.id
  limit 1;
  if v_template is null then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_serial := 'SNX-' || pg_catalog.upper(pg_catalog.replace(gen_random_uuid()::text, '-', ''));
  insert into public.certificate_issuances (
    seminar_id, registration_id, student_user_id, serial, template_snapshot
  ) values (
    new.seminar_id, new.registration_id, new.student_user_id, v_serial, v_template
  ) on conflict (registration_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_certificate_issuance() from public, anon, authenticated;

create trigger evaluation_responses_create_certificate_issuance
  after insert on public.evaluation_responses
  for each row execute function private.create_certificate_issuance();

create function public.get_my_certificate(p_seminar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_issuance public.certificate_issuances;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  select issuance.* into v_issuance
  from public.certificate_issuances as issuance
  where issuance.seminar_id = p_seminar_id and issuance.student_user_id = v_uid;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  return pg_catalog.to_jsonb(v_issuance);
end;
$$;
revoke all on function public.get_my_certificate(uuid) from public, anon;
grant execute on function public.get_my_certificate(uuid) to authenticated;

create function public.get_certificate_generation_input(p_seminar_id uuid)
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
    'serial', issuance.serial,
    'status', issuance.status,
    'objectPath', issuance.object_path,
    'template', issuance.template_snapshot,
    'seminarTitle', seminar.title,
    'studentName', coalesce(
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', profile.first_name, profile.middle_initial, profile.last_name)), ''),
      profile.display_name,
      profile.student_id
    )
  ) into v_input
  from public.certificate_issuances as issuance
  join public.seminars as seminar on seminar.id = issuance.seminar_id
  join public.profiles as profile on profile.id = issuance.student_user_id
  where issuance.seminar_id = p_seminar_id and issuance.student_user_id = v_uid;
  if v_input is null then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  return v_input;
end;
$$;
revoke all on function public.get_certificate_generation_input(uuid) from public, anon;
grant execute on function public.get_certificate_generation_input(uuid) to authenticated;

create function public.finalize_certificate_issuance(p_registration_id uuid, p_object_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issuance public.certificate_issuances;
begin
  if p_object_path is null or p_object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  select issuance.* into v_issuance
  from public.certificate_issuances as issuance
  where issuance.registration_id = p_registration_id
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if p_object_path <> v_issuance.seminar_id::text || '/' || v_issuance.registration_id::text || '.pdf' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  if v_issuance.status = 'issued' then
    if v_issuance.object_path <> p_object_path then raise exception using errcode = 'P0001', message = 'conflict'; end if;
    return pg_catalog.to_jsonb(v_issuance);
  end if;
  if not exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'certificates' and object.name = p_object_path
  ) then raise exception using errcode = 'P0001', message = 'not_available'; end if;

  update public.certificate_issuances as issuance
  set status = 'issued', object_path = p_object_path,
      issued_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where issuance.registration_id = p_registration_id
  returning * into v_issuance;
  return pg_catalog.to_jsonb(v_issuance);
end;
$$;
revoke all on function public.finalize_certificate_issuance(uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_certificate_issuance(uuid, text) to service_role;

create function public.get_org_seminar_certificates(p_seminar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb;
begin
  if v_uid is null or not exists (
    select 1
    from public.seminars seminar
    join public.organization_memberships membership on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id
      and membership.user_id = v_uid
      and membership.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select pg_catalog.jsonb_build_object(
    'template', (
      select draft.certificate_template
      from public.seminar_drafts as draft
      where draft.published_seminar_id = p_seminar_id and draft.certificate_template is not null
      order by draft.updated_at desc, draft.id
      limit 1
    ),
    'records', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', registration.id,
        'seminarId', registration.seminar_id,
        'studentId', coalesce(profile.student_id, profile.email),
        'state', case
          when issuance.status = 'issued' then 'issued'
          when registration.time_in_at is null then 'blocked'
          when registration.time_out_at is null then 'blocked'
          when not private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp()) then 'blocked'
          when registration.evaluation_submitted_at is null then 'waiting'
          else 'waiting'
        end,
        'reason', case
          when issuance.status = 'issued' then 'Certificate issued.'
          when registration.time_in_at is null then 'No time-in was recorded.'
          when registration.time_out_at is null then 'No time-out was recorded.'
          when not private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp()) then 'Attendance requirement not met.'
          when registration.evaluation_submitted_at is null then 'Complete the evaluation to receive the certificate.'
          else 'Certificate PDF is being prepared.'
        end,
        'issuedAt', issuance.issued_at,
        'serial', issuance.serial
      ) order by profile.student_id, registration.id)
      from public.registrations as registration
      join public.profiles as profile on profile.id = registration.student_user_id
      left join public.certificate_issuances as issuance on issuance.registration_id = registration.id
      where registration.seminar_id = p_seminar_id
        and registration.status in ('registered', 'confirmed')
    ), '[]'::jsonb),
    'overrideRequests', '[]'::jsonb
  ) into v_data;
  return v_data;
end;
$$;
revoke all on function public.get_org_seminar_certificates(uuid) from public, anon;
grant execute on function public.get_org_seminar_certificates(uuid) to authenticated;

create function private.certificate_serial_from_registration(p_registration_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select issuance.serial
  from public.certificate_issuances as issuance
  where issuance.registration_id = p_registration_id
$$;
revoke all on function private.certificate_serial_from_registration(uuid) from public, anon, authenticated;

create or replace function public.submit_evaluation(p_seminar_id uuid, p_survey_id text, p_survey_version integer, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_registration public.registrations;
  v_survey public.seminar_survey_versions;
  v_existing public.evaluation_responses;
  v_response public.evaluation_responses;
  v_certificate_serial text;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id and registration.student_user_id = v_uid
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  select response.* into v_existing
  from public.evaluation_responses as response
  where response.registration_id = v_registration.id;
  if found then
    select version_row.* into v_survey from public.seminar_survey_versions as version_row where version_row.id = v_existing.survey_version_id;
    if v_survey.source_survey_id = p_survey_id and v_survey.version = p_survey_version and v_existing.answers = p_answers then
      select private.certificate_serial_from_registration(v_registration.id) into v_certificate_serial;
      return pg_catalog.jsonb_build_object('submittedAt', v_existing.submitted_at, 'certificateSerial', v_certificate_serial);
    end if;
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  if not private.is_evaluation_eligible(v_registration.id, pg_catalog.clock_timestamp()) then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;
  select version_row.* into v_survey
  from public.seminar_survey_versions as version_row
  where version_row.seminar_id = p_seminar_id
    and version_row.source_survey_id = p_survey_id
    and version_row.version = p_survey_version;
  if not found then raise exception using errcode = 'P0001', message = 'conflict'; end if;
  if not private.valid_evaluation_answers(v_survey.definition, p_answers) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  insert into public.evaluation_responses (seminar_id, registration_id, student_user_id, survey_version_id, answers)
  values (p_seminar_id, v_registration.id, v_uid, v_survey.id, p_answers)
  returning * into v_response;
  select private.certificate_serial_from_registration(v_registration.id) into v_certificate_serial;
  if v_certificate_serial is null then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  return pg_catalog.jsonb_build_object('submittedAt', v_response.submitted_at, 'certificateSerial', v_certificate_serial);
end;
$$;
revoke all on function public.submit_evaluation(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.submit_evaluation(uuid, text, integer, jsonb) to authenticated;
