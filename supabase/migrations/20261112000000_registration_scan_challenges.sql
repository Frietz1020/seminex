create extension if not exists pgcrypto with schema extensions;

alter table public.registrations
  add column scan_token_hash bytea not null
  default extensions.digest(extensions.gen_random_bytes(32), 'sha256');

create table private.registration_scan_challenges (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  seminar_id uuid not null references public.seminars (id) on delete cascade,
  challenge_hash bytea not null unique,
  binding_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_officer_id uuid references public.profiles (id) on delete restrict,
  idempotency_key uuid,
  ledger_id uuid references public.attendance_ledger (id) on delete restrict,
  constraint registration_scan_challenge_consumption_check check (
    (consumed_at is null and consumed_officer_id is null and idempotency_key is null and ledger_id is null)
    or (consumed_at is not null and consumed_officer_id is not null and idempotency_key is not null and ledger_id is not null)
  )
);
create index registration_scan_challenges_registration_idx
  on private.registration_scan_challenges (registration_id, expires_at desc);
revoke all on private.registration_scan_challenges from public, anon, authenticated;

create function public.issue_attendance_challenge(p_seminar_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_registration public.registrations;
  v_seminar public.seminars;
  v_challenge text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'session_expired';
  end if;
  select seminar.* into v_seminar from public.seminars seminar
  where seminar.id = p_seminar_id and seminar.seminar_type = 'seminar'
    and seminar.publication_status = 'published';
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  select registration.* into v_registration from public.registrations registration
  where registration.seminar_id = p_seminar_id and registration.student_user_id = auth.uid()
    and registration.status in ('registered', 'confirmed')
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  if v_registration.time_in_at is null then
    if v_now < v_seminar.starts_at or v_now >= v_seminar.ends_at then
      raise exception using errcode = 'P0001', message = 'not_available';
    end if;
  elsif v_registration.time_out_at is null then
    if v_now < v_seminar.starts_at or v_now > v_seminar.ends_at + interval '1 hour' then
      raise exception using errcode = 'P0001', message = 'not_available';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_challenge := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := v_now + interval '30 seconds';
  insert into private.registration_scan_challenges (
    registration_id, seminar_id, challenge_hash, binding_hash, expires_at
  ) values (
    v_registration.id, p_seminar_id,
    extensions.digest(v_challenge, 'sha256'),
    extensions.digest(v_challenge || pg_catalog.encode(v_registration.scan_token_hash, 'hex'), 'sha256'),
    v_expires_at
  );
  return pg_catalog.jsonb_build_object('challenge', v_challenge, 'expires_at', v_expires_at);
end;
$$;
revoke all on function public.issue_attendance_challenge(uuid) from public, anon, authenticated;
grant execute on function public.issue_attendance_challenge(uuid) to authenticated;

create function public.record_org_challenge_scan(
  p_seminar_id uuid,
  p_challenge text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_officer uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_challenge private.registration_scan_challenges;
  v_registration public.registrations;
  v_seminar public.seminars;
  v_student public.profiles;
  v_entry public.attendance_ledger;
  v_kind text;
begin
  if v_officer is null then raise exception using errcode = 'P0001', message = 'session_expired'; end if;
  if p_idempotency_key is null or p_challenge is null or p_challenge !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  select seminar.* into v_seminar from public.seminars seminar
  join public.organization_memberships membership on membership.organization_id = seminar.organization_id
  where seminar.id = p_seminar_id and seminar.seminar_type = 'seminar'
    and seminar.publication_status = 'published' and membership.user_id = v_officer
    and membership.status = 'active' and membership.role = 'org_member'
  for share of membership;
  if not found then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  select challenge.* into v_challenge from private.registration_scan_challenges challenge
  where challenge.challenge_hash = extensions.digest(p_challenge, 'sha256')
  for update;
  if not found or v_challenge.seminar_id <> p_seminar_id then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select registration.* into v_registration from public.registrations registration
  where registration.id = v_challenge.registration_id
  for update;
  if not found or v_challenge.binding_hash <> extensions.digest(
    p_challenge || pg_catalog.encode(v_registration.scan_token_hash, 'hex'), 'sha256'
  ) then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  if v_challenge.consumed_at is not null then
    if v_challenge.consumed_officer_id = v_officer and v_challenge.idempotency_key = p_idempotency_key then
      select entry.* into v_entry from public.attendance_ledger entry where entry.id = v_challenge.ledger_id;
      select profile.* into v_student from public.profiles profile where profile.id = v_registration.student_user_id;
      return pg_catalog.jsonb_build_object(
        'entry', pg_catalog.to_jsonb(v_entry) || pg_catalog.jsonb_build_object('officer_name', coalesce((select profile.display_name from public.profiles profile where profile.id = v_officer), '')),
        'student', pg_catalog.jsonb_build_object('studentId', v_student.student_id,
          'firstName', coalesce(v_student.first_name, ''), 'lastName', coalesce(v_student.last_name, ''),
          'middleInitial', coalesce(v_student.middle_initial, ''), 'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
          'program', coalesce(v_student.program, ''), 'yearLevel', v_student.year_level,
          'block', coalesce(v_student.block, ''), 'avatarUrl', v_student.avatar_url)
      );
    end if;
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  if v_challenge.expires_at <= v_now then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  if v_registration.seminar_id <> p_seminar_id or v_registration.status not in ('registered', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_seminar.starts_at is null or v_seminar.ends_at is null or v_now < v_seminar.starts_at
    or v_now > v_seminar.ends_at + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;
  if v_registration.time_in_at is null then
    if v_now >= v_seminar.ends_at then raise exception using errcode = 'P0001', message = 'not_available'; end if;
    v_kind := 'time_in';
  elsif v_registration.time_out_at is null then
    v_kind := 'time_out';
  else
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  if exists (select 1 from public.attendance_ledger entry where entry.officer_user_id = v_officer and entry.idempotency_key = p_idempotency_key) then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  select profile.* into v_student from public.profiles profile where profile.id = v_registration.student_user_id;
  insert into public.attendance_ledger (seminar_id, registration_id, student_user_id, kind, event_at, method, officer_user_id, idempotency_key)
  values (p_seminar_id, v_registration.id, v_student.id, v_kind, v_now, 'qr', v_officer, p_idempotency_key)
  returning * into v_entry;
  update public.registrations registration set
    time_in_at = case when v_kind = 'time_in' then v_now else registration.time_in_at end,
    time_out_at = case when v_kind = 'time_out' then v_now else registration.time_out_at end
  where registration.id = v_registration.id;
  update private.registration_scan_challenges set consumed_at = v_now,
    consumed_officer_id = v_officer, idempotency_key = p_idempotency_key, ledger_id = v_entry.id
  where id = v_challenge.id;
  return pg_catalog.jsonb_build_object(
    'entry', pg_catalog.to_jsonb(v_entry) || pg_catalog.jsonb_build_object('officer_name', coalesce((select profile.display_name from public.profiles profile where profile.id = v_officer), '')),
    'student', pg_catalog.jsonb_build_object('studentId', v_student.student_id,
      'firstName', coalesce(v_student.first_name, ''), 'lastName', coalesce(v_student.last_name, ''),
      'middleInitial', coalesce(v_student.middle_initial, ''), 'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
      'program', coalesce(v_student.program, ''), 'yearLevel', v_student.year_level,
      'block', coalesce(v_student.block, ''), 'avatarUrl', v_student.avatar_url)
  );
end;
$$;
revoke all on function public.record_org_challenge_scan(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_org_challenge_scan(uuid, text, uuid) to authenticated;

create or replace function public.record_org_scan(
  p_seminar_id uuid,
  p_student_id text,
  p_method text,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'session_expired'; end if;
  select seminar.organization_id into v_organization_id from public.seminars seminar
  where seminar.id = p_seminar_id and seminar.publication_status = 'published' and seminar.seminar_type = 'seminar';
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  perform 1 from public.organization_memberships membership
  where membership.organization_id = v_organization_id and membership.user_id = v_uid
    and membership.status = 'active' and membership.role = 'org_member' for share;
  if not found then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  if p_method <> 'manual' then raise exception using errcode = 'P0001', message = 'validation_failed'; end if;
  return private.record_org_scan_unchecked(p_seminar_id, p_student_id, p_method, p_reason, p_idempotency_key);
end;
$$;
revoke all on function public.record_org_scan(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_org_scan(uuid, text, text, text, uuid) to authenticated;
