create function public.acknowledge_attendance(p_seminar_id uuid)
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
  if v_now < v_seminar.starts_at - interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  update public.registrations as registration
  set attendance_ack_at = v_now
  where registration.id = v_registration.id;
end;
$$;

create function public.get_server_time()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select pg_catalog.clock_timestamp();
$$;

revoke all on function public.acknowledge_attendance(uuid) from public, anon, authenticated;
revoke all on function public.get_server_time() from public, anon, authenticated;
grant execute on function public.acknowledge_attendance(uuid) to authenticated;
grant execute on function public.get_server_time() to anon, authenticated;
