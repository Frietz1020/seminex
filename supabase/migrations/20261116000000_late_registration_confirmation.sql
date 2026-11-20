create or replace function public.register_for_seminar(p_seminar_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seminar public.seminars;
  v_registration public.registrations;
  v_active_count integer;
  v_has_registration boolean;
  v_now timestamptz;
  v_opens_at timestamptz;
  v_auto_confirm boolean;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and student_id is not null) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select seminar.* into v_seminar
  from public.seminars as seminar
  where seminar.id = p_seminar_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  v_now := pg_catalog.clock_timestamp();
  if v_seminar.publication_status <> 'published' or v_seminar.starts_at is null or v_seminar.ends_at <= v_now then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  perform private.release_expired_registrations(p_seminar_id);

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid
  for update;
  v_has_registration := found;

  if v_has_registration and v_registration.status in ('registered', 'confirmed') then
    return v_registration;
  end if;

  select count(*)::integer into v_active_count
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.status in ('registered', 'confirmed');

  if v_active_count >= v_seminar.capacity then
    raise exception using errcode = 'P0001', message = 'seminar_full';
  end if;

  v_now := pg_catalog.clock_timestamp();
  if v_seminar.ends_at <= v_now then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_opens_at := v_seminar.starts_at - pg_catalog.make_interval(mins => v_seminar.confirmation_opens_minutes_before);
  v_auto_confirm := v_now >= v_opens_at and v_now < v_seminar.ends_at;

  if v_has_registration then
    update public.registrations as registration
    set status = case when v_auto_confirm then 'confirmed' else 'registered' end,
        registered_at = v_now,
        confirmed_at = case when v_auto_confirm then v_now else null end,
        attendance_ack_at = null,
        time_in_at = null,
        time_out_at = null
    where registration.id = v_registration.id
    returning registration.* into v_registration;
  else
    insert into public.registrations (
      seminar_id, student_user_id, status, registered_at, confirmed_at
    )
    values (
      p_seminar_id,
      v_uid,
      case when v_auto_confirm then 'confirmed' else 'registered' end,
      v_now,
      case when v_auto_confirm then v_now else null end
    )
    returning * into v_registration;
  end if;

  perform private.release_expired_registrations(p_seminar_id);

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid;
  return v_registration;
end;
$$;

revoke all on function public.register_for_seminar(uuid) from public, anon, authenticated;
grant execute on function public.register_for_seminar(uuid) to authenticated;
