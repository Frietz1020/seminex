alter table public.profiles
  add column avatar_url text check (avatar_url is null or length(avatar_url) <= 2048);

create table public.attendance_ledger (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  registration_id uuid not null references public.registrations (id) on delete restrict,
  student_user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('time_in', 'time_out', 'correction')),
  event_at timestamptz not null,
  method text not null check (method in ('qr', 'manual', 'webinar_proof', 'correction')),
  reason text,
  officer_user_id uuid not null references public.profiles (id) on delete restrict,
  idempotency_key uuid,
  corrects_entry_id uuid references public.attendance_ledger (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint attendance_ledger_reason_check check (method <> 'manual' or (reason is not null and length(trim(reason)) >= 5)),
  constraint attendance_ledger_correction_check check (
    (kind = 'correction') = (method = 'correction')
    and (kind <> 'correction' or (corrects_entry_id is not null and reason is not null and length(trim(reason)) >= 5))
  ),
  unique (officer_user_id, idempotency_key)
);
create index attendance_ledger_seminar_student_time_idx on public.attendance_ledger (seminar_id, student_user_id, event_at, id);
create index attendance_ledger_registration_time_idx on public.attendance_ledger (registration_id, event_at, id);

create function private.prevent_attendance_ledger_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'attendance_ledger_append_only';
end;
$$;
revoke all on function private.prevent_attendance_ledger_mutation() from public, anon, authenticated;
create trigger attendance_ledger_append_only before update or delete on public.attendance_ledger
  for each row execute function private.prevent_attendance_ledger_mutation();

create table public.webinar_proofs (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  registration_id uuid not null references public.registrations (id) on delete restrict,
  student_user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('time_in', 'time_out')),
  object_path text not null unique,
  content_type text not null check (content_type in ('image/png', 'image/jpeg')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  submitted_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint webinar_proof_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null and length(trim(rejection_reason)) > 0)
  ),
  unique (student_user_id, idempotency_key)
);
create index webinar_proofs_review_idx on public.webinar_proofs (seminar_id, status, submitted_at);
create unique index webinar_proofs_one_unresolved_checkpoint_idx on public.webinar_proofs (registration_id, kind) where status in ('pending', 'approved');

alter table public.attendance_ledger enable row level security;
alter table public.webinar_proofs enable row level security;
revoke all on public.attendance_ledger, public.webinar_proofs from anon, authenticated;
grant select on public.attendance_ledger, public.webinar_proofs to authenticated;

create policy "Organization members can read profiles on seminar rosters" on public.profiles for select to authenticated
using (exists (
  select 1 from public.registrations registration
  join public.seminars seminar on seminar.id = registration.seminar_id
  join public.organization_memberships membership on membership.organization_id = seminar.organization_id
  where registration.student_user_id = profiles.id
    and membership.user_id = (select auth.uid()) and membership.status = 'active'
));

create policy "Students and organization members can read attendance ledger" on public.attendance_ledger for select to authenticated
using (student_user_id = (select auth.uid()) or exists (
  select 1 from public.seminars seminar join public.organization_memberships membership on membership.organization_id = seminar.organization_id
  where seminar.id = attendance_ledger.seminar_id and membership.user_id = (select auth.uid()) and membership.status = 'active'
));
create policy "Students and organization members can read webinar proofs" on public.webinar_proofs for select to authenticated
using (student_user_id = (select auth.uid()) or exists (
  select 1 from public.seminars seminar join public.organization_memberships membership on membership.organization_id = seminar.organization_id
  where seminar.id = webinar_proofs.seminar_id and membership.user_id = (select auth.uid()) and membership.status = 'active'
));

create function public.record_org_scan(p_seminar_id uuid, p_student_id text, p_method text, p_reason text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_officer uuid := auth.uid(); v_seminar public.seminars; v_registration public.registrations;
  v_student public.profiles; v_prior public.attendance_ledger; v_entry public.attendance_ledger;
  v_kind text; v_now timestamptz; v_response jsonb;
begin
  if v_officer is null or p_idempotency_key is null or p_method is null or p_method not in ('qr', 'manual') then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  if p_method = 'manual' and (p_reason is null or length(trim(p_reason)) < 5 or length(p_reason) > 500) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  select seminar.* into v_seminar from public.seminars seminar where seminar.id = p_seminar_id;
  if not found or v_seminar.seminar_type <> 'seminar' or v_seminar.publication_status <> 'published' or not exists (
    select 1 from public.organization_memberships membership where membership.organization_id = v_seminar.organization_id
      and membership.user_id = v_officer and membership.status = 'active'
  ) then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  select profile.* into v_student from public.profiles profile where profile.student_id = p_student_id;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  select entry.* into v_prior from public.attendance_ledger entry
    where entry.officer_user_id = v_officer and entry.idempotency_key = p_idempotency_key;
  if found then
    if v_prior.seminar_id <> p_seminar_id or v_prior.student_user_id <> v_student.id or v_prior.method <> p_method then
      raise exception using errcode = 'P0001', message = 'conflict';
    end if;
    select profile.* into v_student from public.profiles profile where profile.id = v_prior.student_user_id;
    return jsonb_build_object('entry', to_jsonb(v_prior) || jsonb_build_object('officer_name', coalesce((select profile.display_name from public.profiles profile where profile.id = v_officer), '')), 'student', jsonb_build_object(
      'studentId', v_student.student_id, 'firstName', coalesce(v_student.first_name, ''),
      'lastName', coalesce(v_student.last_name, ''), 'middleInitial', coalesce(v_student.middle_initial, ''),
      'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
      'program', coalesce(v_student.program, ''), 'yearLevel', v_student.year_level,
      'block', coalesce(v_student.block, ''), 'avatarUrl', v_student.avatar_url));
  end if;
  perform private.release_expired_registrations(p_seminar_id);
  select registration.* into v_registration from public.registrations registration
    where registration.seminar_id = p_seminar_id and registration.student_user_id = v_student.id
      and registration.status in ('registered', 'confirmed') for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  select entry.* into v_prior from public.attendance_ledger entry
    where entry.officer_user_id = v_officer and entry.idempotency_key = p_idempotency_key;
  if found then
    if v_prior.seminar_id <> p_seminar_id or v_prior.student_user_id <> v_student.id or v_prior.method <> p_method then
      raise exception using errcode = 'P0001', message = 'conflict';
    end if;
    return jsonb_build_object('entry', to_jsonb(v_prior), 'student', jsonb_build_object(
      'studentId', v_student.student_id, 'firstName', coalesce(v_student.first_name, ''),
      'lastName', coalesce(v_student.last_name, ''), 'middleInitial', coalesce(v_student.middle_initial, ''),
      'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
      'program', coalesce(v_student.program, ''), 'yearLevel', v_student.year_level,
      'block', coalesce(v_student.block, ''), 'avatarUrl', v_student.avatar_url));
  end if;
  v_now := pg_catalog.clock_timestamp();
  if v_seminar.starts_at is null or v_seminar.ends_at is null or v_now < v_seminar.starts_at
    or v_now > v_seminar.ends_at + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;
  if v_registration.time_in_at is null then
    if v_now >= v_seminar.ends_at then raise exception using errcode = 'P0001', message = 'not_available'; end if;
    v_kind := 'time_in';
  elsif v_registration.time_out_at is null then v_kind := 'time_out';
  else raise exception using errcode = 'P0001', message = 'not_available'; end if;
  insert into public.attendance_ledger (seminar_id, registration_id, student_user_id, kind, event_at, method, reason, officer_user_id, idempotency_key)
    values (p_seminar_id, v_registration.id, v_student.id, v_kind, v_now, p_method,
      case when p_method = 'manual' then trim(p_reason) else null end, v_officer, p_idempotency_key)
    returning * into v_entry;
  update public.registrations registration set
    time_in_at = case when v_kind = 'time_in' then v_now else registration.time_in_at end,
    time_out_at = case when v_kind = 'time_out' then v_now else registration.time_out_at end
    where registration.id = v_registration.id;
  v_response := jsonb_build_object('entry', to_jsonb(v_entry) || jsonb_build_object('officer_name', coalesce((select profile.display_name from public.profiles profile where profile.id = v_officer), '')),
    'student', jsonb_build_object(
    'studentId', v_student.student_id, 'firstName', coalesce(v_student.first_name, ''),
    'lastName', coalesce(v_student.last_name, ''), 'middleInitial', coalesce(v_student.middle_initial, ''),
    'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
    'program', coalesce(v_student.program, ''), 'yearLevel', v_student.year_level,
    'block', coalesce(v_student.block, ''), 'avatarUrl', v_student.avatar_url));
  return v_response;
end;
$$;

create function public.list_org_roster(p_seminar_id uuid)
returns table (
  id uuid, seminar_id uuid, student_id text, first_name text, last_name text, middle_initial text,
  program text, year_level smallint, block text, email text, avatar_url text,
  registered_at timestamptz, status text, confirmed_at timestamptz, attendance_ack_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.seminars seminar
    join public.organization_memberships membership on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id and membership.user_id = auth.uid() and membership.status = 'active') then
    raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  return query select registration.id, registration.seminar_id, profile.student_id,
    profile.first_name, profile.last_name, profile.middle_initial, profile.program,
    profile.year_level, profile.block, profile.email, profile.avatar_url,
    registration.registered_at, registration.status, registration.confirmed_at, registration.attendance_ack_at
  from public.registrations registration
  join public.profiles profile on profile.id = registration.student_user_id
  where registration.seminar_id = p_seminar_id order by registration.registered_at, registration.id;
end;
$$;

create function public.list_attendance_ledger(p_seminar_id uuid)
returns table (
  id uuid, seminar_id uuid, student_id text, kind text, event_at timestamptz, method text,
  reason text, officer_id uuid, officer_name text, corrects_entry_id uuid
)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.seminars seminar
    join public.organization_memberships membership on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id and membership.user_id = auth.uid() and membership.status = 'active') then
    raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  return query select ledger.id, ledger.seminar_id, student.student_id, ledger.kind, ledger.event_at,
    ledger.method, ledger.reason, officer.id, coalesce(officer.display_name, concat_ws(' ', officer.first_name, officer.last_name)),
    ledger.corrects_entry_id
  from public.attendance_ledger ledger
  join public.profiles student on student.id = ledger.student_user_id
  join public.profiles officer on officer.id = ledger.officer_user_id
  where ledger.seminar_id = p_seminar_id order by ledger.event_at desc, ledger.id desc;
end;
$$;

create function public.register_webinar_proof(p_student_user_id uuid, p_seminar_id uuid, p_kind text,
  p_object_path text, p_content_type text, p_byte_size integer, p_idempotency_key uuid)
returns public.webinar_proofs language plpgsql security definer set search_path = '' as $$
declare
  v_seminar public.seminars; v_registration public.registrations; v_now timestamptz := pg_catalog.clock_timestamp();
  v_existing public.webinar_proofs; v_proof public.webinar_proofs;
begin
  if p_kind not in ('time_in', 'time_out') or p_idempotency_key is null
    or p_content_type not in ('image/png', 'image/jpeg') or p_byte_size not between 1 and 5242880
    or p_object_path !~ ('^' || p_student_user_id::text || '/' || p_seminar_id::text || '/[0-9a-f-]+\.(png|jpg)$') then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  select proof.* into v_existing from public.webinar_proofs proof
    where proof.student_user_id = p_student_user_id and proof.idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  select seminar.* into v_seminar from public.seminars seminar
    where seminar.id = p_seminar_id and seminar.seminar_type = 'webinar' and seminar.publication_status = 'published';
  if not found then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  select registration.* into v_registration from public.registrations registration
    where registration.seminar_id = p_seminar_id and registration.student_user_id = p_student_user_id and registration.status = 'confirmed'
    for update;
  if not found then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  select proof.* into v_existing from public.webinar_proofs proof
    where proof.student_user_id = p_student_user_id and proof.idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  if p_kind = 'time_in' then
    if v_now < v_seminar.starts_at or v_now > v_seminar.ends_at or v_registration.time_in_at is not null then
      raise exception using errcode = 'P0001', message = 'not_available'; end if;
  elsif v_now < v_seminar.ends_at - interval '15 minutes' or v_now > v_seminar.ends_at + interval '1 hour'
    or v_registration.time_out_at is not null then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;
  if exists (select 1 from public.webinar_proofs proof where proof.registration_id = v_registration.id
    and proof.kind = p_kind and proof.status in ('pending', 'approved')) then
    raise exception using errcode = 'P0001', message = 'conflict'; end if;
  insert into public.webinar_proofs (seminar_id, registration_id, student_user_id, kind, object_path, content_type, byte_size, submitted_at, idempotency_key)
    values (p_seminar_id, v_registration.id, p_student_user_id, p_kind, p_object_path, p_content_type, p_byte_size, v_now, p_idempotency_key)
    returning * into v_proof;
  return v_proof;
end;
$$;

create function public.review_webinar_proof(p_proof_id uuid, p_approve boolean, p_reason text default null)
returns public.webinar_proofs language plpgsql security definer set search_path = '' as $$
declare
  v_officer uuid := auth.uid(); v_proof public.webinar_proofs; v_seminar public.seminars; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_officer is null or (not p_approve and (p_reason is null or length(trim(p_reason)) = 0 or length(p_reason) > 1000)) then
    raise exception using errcode = 'P0001', message = 'validation_failed'; end if;
  select proof.* into v_proof from public.webinar_proofs proof where proof.id = p_proof_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  select seminar.* into v_seminar from public.seminars seminar where seminar.id = v_proof.seminar_id;
  if v_seminar.publication_status <> 'published' then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  if not exists (select 1 from public.organization_memberships membership where membership.organization_id = v_seminar.organization_id
    and membership.user_id = v_officer and membership.status = 'active') then
    raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  if v_proof.status <> 'pending' then raise exception using errcode = 'P0001', message = 'conflict'; end if;
  update public.webinar_proofs proof set status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = v_officer, reviewed_at = v_now, rejection_reason = case when p_approve then null else trim(p_reason) end
    where proof.id = p_proof_id returning * into v_proof;
  if p_approve then
    insert into public.attendance_ledger (seminar_id, registration_id, student_user_id, kind, event_at, method, officer_user_id)
      values (v_proof.seminar_id, v_proof.registration_id, v_proof.student_user_id, v_proof.kind, v_proof.submitted_at, 'webinar_proof', v_officer);
    update public.registrations registration set
      time_in_at = case when v_proof.kind = 'time_in' then v_proof.submitted_at else registration.time_in_at end,
      time_out_at = case when v_proof.kind = 'time_out' then v_proof.submitted_at else registration.time_out_at end
      where registration.id = v_proof.registration_id;
  end if;
  return v_proof;
end;
$$;

create function public.list_webinar_proofs(p_seminar_id uuid)
returns setof public.webinar_proofs language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.seminars seminar
    join public.organization_memberships membership on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id and seminar.seminar_type = 'webinar'
      and membership.user_id = auth.uid() and membership.status = 'active') then
    raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  return query select proof.* from public.webinar_proofs proof where proof.seminar_id = p_seminar_id order by proof.submitted_at, proof.id;
end;
$$;

revoke all on function public.record_org_scan(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.register_webinar_proof(uuid, uuid, text, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.review_webinar_proof(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.list_webinar_proofs(uuid) from public, anon, authenticated;
revoke all on function public.list_org_roster(uuid) from public, anon, authenticated;
revoke all on function public.list_attendance_ledger(uuid) from public, anon, authenticated;
grant execute on function public.record_org_scan(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.register_webinar_proof(uuid, uuid, text, text, text, integer, uuid) to service_role;
grant execute on function public.review_webinar_proof(uuid, boolean, text) to authenticated;
grant execute on function public.list_webinar_proofs(uuid) to authenticated;
grant execute on function public.list_org_roster(uuid) to authenticated;
grant execute on function public.list_attendance_ledger(uuid) to authenticated;

create function public.set_my_avatar(p_object_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_old_path text;
begin
  if v_uid is null or p_object_path !~ ('^' || v_uid::text || '/[0-9a-f-]+\.(png|jpg)$')
    or not exists (select 1 from storage.objects object
      where object.bucket_id = 'avatars' and object.name = p_object_path) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  select profile.avatar_url into v_old_path from public.profiles profile where profile.id = v_uid for update;
  update public.profiles set avatar_url = p_object_path where id = v_uid;
  return v_old_path;
end;
$$;
revoke all on function public.set_my_avatar(text) from public, anon, authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('webinar-proofs', 'webinar-proofs', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg'];

create policy "Students can upload their own avatar files" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students can update their own avatar files" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students can remove their own unused avatar files" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students and roster officers can read profile avatars" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and exists (
  select 1 from public.profiles profile where profile.avatar_url = storage.objects.name
));

create policy "Students and organization members can read authorized webinar proof files" on storage.objects for select to authenticated
using (bucket_id = 'webinar-proofs' and exists (
  select 1 from public.webinar_proofs proof where proof.object_path = storage.objects.name
    and (proof.student_user_id = (select auth.uid()) or exists (
      select 1 from public.seminars seminar join public.organization_memberships membership on membership.organization_id = seminar.organization_id
      where seminar.id = proof.seminar_id and membership.user_id = (select auth.uid()) and membership.status = 'active'
    ))
));

grant update (program, year_level, block) on public.profiles to authenticated;
