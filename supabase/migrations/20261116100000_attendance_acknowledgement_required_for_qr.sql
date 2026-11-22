create or replace function public.acknowledge_attendance(p_seminar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seminar public.seminars;
  v_registration public.registrations;
  v_now timestamptz;
  v_confirmation_closes_at timestamptz;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and student_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select seminar.* into v_seminar
  from public.seminars as seminar
  where seminar.id = p_seminar_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_seminar.publication_status <> 'published' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_registration.status <> 'confirmed' or v_registration.confirmed_at is null then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_confirmation_closes_at := v_seminar.starts_at
    - pg_catalog.make_interval(mins => v_seminar.confirmation_closes_minutes_before);
  if v_now < v_seminar.starts_at - interval '1 hour'
    and v_registration.confirmed_at < v_confirmation_closes_at then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  update public.registrations as registration
  set attendance_ack_at = v_now
  where registration.id = v_registration.id;
end;
$$;

revoke all on function public.acknowledge_attendance(uuid) from public, anon, authenticated;
grant execute on function public.acknowledge_attendance(uuid) to authenticated;

create or replace function public.issue_attendance_challenge(p_seminar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  select seminar.* into v_seminar
  from public.seminars as seminar
  where seminar.id = p_seminar_id
    and seminar.seminar_type = 'seminar'
    and seminar.publication_status = 'published';
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = auth.uid()
    and registration.status in ('registered', 'confirmed')
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_registration.attendance_ack_at is null then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

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
