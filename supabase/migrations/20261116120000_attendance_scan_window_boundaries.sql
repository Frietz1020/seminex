create or replace function private.attendance_scan_window(
  p_now timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_kind text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_now is null or p_starts_at is null or p_ends_at is null then false
    when p_kind = 'time_in' then p_now >= p_starts_at and p_now < p_ends_at
    when p_kind = 'time_out' then p_now >= p_starts_at and p_now <= p_ends_at + interval '1 hour'
    else false
  end;
$$;

revoke all on function private.attendance_scan_window(timestamptz, timestamptz, timestamptz, text) from public, anon, authenticated;

create or replace function public.record_org_challenge_scan(
  p_seminar_id uuid,
  p_challenge text,
  p_idempotency_key uuid,
  p_kind text
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
  if p_idempotency_key is null or p_challenge is null or p_challenge !~ '^[a-f0-9]{64}$'
    or p_kind is null or p_kind not in ('time_in', 'time_out') then
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
      if found and v_entry.kind = p_kind then
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
    end if;
    raise exception using errcode = 'P0001', message = 'challenge_replayed';
  end if;
  if v_challenge.expires_at <= v_now then raise exception using errcode = 'P0001', message = 'challenge_expired'; end if;
  if v_registration.seminar_id <> p_seminar_id or v_registration.status not in ('registered', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'registration_inactive';
  end if;
  if not private.attendance_scan_window(v_now, v_seminar.starts_at, v_seminar.ends_at, p_kind) then
    raise exception using errcode = 'P0001', message = 'outside_scan_window';
  end if;
  if v_registration.time_in_at is null then
    v_kind := 'time_in';
  elsif v_registration.time_out_at is null then
    v_kind := 'time_out';
  else
    raise exception using errcode = 'P0001', message = 'attendance_already_complete';
  end if;
  if p_kind <> v_kind then raise exception using errcode = 'P0001', message = 'wrong_attendance_step'; end if;
  if exists (select 1 from public.attendance_ledger entry where entry.officer_user_id = v_officer and entry.idempotency_key = p_idempotency_key) then
    raise exception using errcode = 'P0001', message = 'idempotency_conflict';
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

revoke all on function public.record_org_challenge_scan(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_org_challenge_scan(uuid, text, uuid, text) to authenticated;
