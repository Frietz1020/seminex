do $$
declare
  v_duplicate_groups bigint;
begin
  select count(*) into v_duplicate_groups
  from (
    select ledger.registration_id, ledger.kind
    from public.attendance_ledger as ledger
    where ledger.kind in ('time_in', 'time_out')
    group by ledger.registration_id, ledger.kind
    having count(*) > 1
  ) as duplicate_modes;

  if v_duplicate_groups > 0 then
    raise exception using
      errcode = '23514',
      message = 'attendance_ledger_duplicate_modes_prevent_constraint',
      detail = pg_catalog.format('%s registration/mode groups contain duplicate attendance events', v_duplicate_groups),
      hint = 'Reconcile attendance history through an auditable data-repair decision, then retry this migration.';
  end if;
end;
$$;

create unique index if not exists attendance_ledger_registration_mode_uidx
  on public.attendance_ledger (registration_id, kind)
  where kind in ('time_in', 'time_out');

create or replace function private.attendance_challenge_is_expired(
  p_now timestamptz,
  p_expires_at timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_now is null or p_expires_at is null or p_now > p_expires_at;
$$;

revoke all on function private.attendance_challenge_is_expired(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.issue_attendance_challenge(p_seminar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
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

  v_now := pg_catalog.clock_timestamp();
  v_expires_at := v_seminar.ends_at + interval '1 hour';
  if v_now >= v_expires_at then
    raise exception using errcode = 'P0001', message = 'attendance_qr_expired';
  end if;

  v_challenge := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.registration_scan_challenges (
    registration_id, seminar_id, challenge_hash, binding_hash, expires_at
  ) values (
    v_registration.id,
    p_seminar_id,
    extensions.digest(v_challenge, 'sha256'),
    extensions.digest(v_challenge || pg_catalog.encode(v_registration.scan_token_hash, 'hex'), 'sha256'),
    v_expires_at
  );

  return pg_catalog.jsonb_build_object('challenge', v_challenge, 'expires_at', v_expires_at);
end;
$$;

revoke all on function public.issue_attendance_challenge(uuid) from public, anon, authenticated;
grant execute on function public.issue_attendance_challenge(uuid) to authenticated;

create or replace function public.record_org_challenge_scan(
  p_seminar_id uuid,
  p_challenge text,
  p_idempotency_key uuid,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer uuid := auth.uid();
  v_started_at timestamptz := pg_catalog.clock_timestamp();
  v_now timestamptz;
  v_request_id text := nullif(current_setting('request.id', true), '');
  v_mode text := case when p_kind in ('time_in', 'time_out') then p_kind else 'invalid' end;
  v_outcome text;
  v_constraint_name text;
  v_challenge private.registration_scan_challenges;
  v_registration public.registrations;
  v_seminar public.seminars;
  v_student public.profiles;
  v_entry public.attendance_ledger;
  v_response jsonb;
begin
  begin
    if v_officer is null then
      raise exception using errcode = 'P0001', message = 'session_expired';
    end if;
    if p_idempotency_key is null or p_challenge is null or p_challenge !~ '^[a-f0-9]{64}$'
      or p_kind is null or p_kind not in ('time_in', 'time_out') then
      raise exception using errcode = 'P0001', message = 'validation_failed';
    end if;

    select seminar.* into v_seminar
    from public.seminars as seminar
    join public.organization_memberships as membership
      on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id
      and membership.user_id = v_officer
      and membership.status = 'active'
      and membership.role = 'org_member'
    for share of membership;
    if not found then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;

    select challenge.* into v_challenge
    from private.registration_scan_challenges as challenge
    where challenge.challenge_hash = extensions.digest(p_challenge, 'sha256')
    for update;
    if not found or v_challenge.seminar_id <> p_seminar_id then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;

    select registration.* into v_registration
    from public.registrations as registration
    where registration.id = v_challenge.registration_id
    for update;
    if not found or v_challenge.binding_hash <> extensions.digest(
      p_challenge || pg_catalog.encode(v_registration.scan_token_hash, 'hex'), 'sha256'
    ) then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;

    select entry.* into v_entry
    from public.attendance_ledger as entry
    where entry.officer_user_id = v_officer
      and entry.idempotency_key = p_idempotency_key;
    if found then
      if v_entry.seminar_id <> p_seminar_id
        or v_entry.registration_id <> v_registration.id
        or v_entry.kind <> p_kind
        or v_entry.method <> 'qr' then
        raise exception using errcode = 'P0001', message = 'idempotency_conflict';
      end if;

      select profile.* into v_student
      from public.profiles as profile
      where profile.id = v_registration.student_user_id;
      v_response := pg_catalog.jsonb_build_object(
        'entry', pg_catalog.to_jsonb(v_entry) || pg_catalog.jsonb_build_object(
          'officer_name', coalesce((select profile.display_name from public.profiles as profile where profile.id = v_officer), '')
        ),
        'student', pg_catalog.jsonb_build_object(
          'studentId', v_student.student_id,
          'firstName', coalesce(v_student.first_name, ''),
          'lastName', coalesce(v_student.last_name, ''),
          'middleInitial', coalesce(v_student.middle_initial, ''),
          'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
          'program', coalesce(v_student.program, ''),
          'yearLevel', v_student.year_level,
          'block', coalesce(v_student.block, ''),
          'avatarUrl', v_student.avatar_url
        )
      );
      v_outcome := 'idempotent_retry';
      raise log 'attendance_scan outcome=% mode=% duration_ms=% request_id=%',
        v_outcome, v_mode, round(extract(epoch from (pg_catalog.clock_timestamp() - v_started_at)) * 1000, 2), v_request_id;
      return v_response;
    end if;

    if v_registration.seminar_id <> p_seminar_id
      or v_registration.status not in ('registered', 'confirmed') then
      raise exception using errcode = 'P0001', message = 'registration_inactive';
    end if;
    if v_seminar.seminar_type <> 'seminar' or v_seminar.publication_status <> 'published' then
      raise exception using errcode = 'P0001', message = 'not_available';
    end if;

    v_now := pg_catalog.clock_timestamp();
    if private.attendance_challenge_is_expired(v_now, v_challenge.expires_at) then
      raise exception using errcode = 'P0001', message = 'challenge_expired';
    end if;

    if exists (
      select 1
      from public.attendance_ledger as entry
      where entry.registration_id = v_registration.id
        and entry.kind = p_kind
    ) then
      raise exception using errcode = 'P0001', message = 'attendance_already_recorded';
    end if;

    if not private.attendance_scan_window(v_now, v_seminar.starts_at, v_seminar.ends_at, p_kind) then
      raise exception using errcode = 'P0001', message = 'outside_scan_window';
    end if;

    if v_registration.time_in_at is null then
      if p_kind <> 'time_in' then
        raise exception using errcode = 'P0001', message = 'wrong_attendance_step';
      end if;
    elsif v_registration.time_out_at is null then
      if p_kind <> 'time_out' then
        raise exception using errcode = 'P0001', message = 'wrong_attendance_step';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'attendance_already_complete';
    end if;

    if exists (
      select 1
      from public.attendance_ledger as entry
      where entry.officer_user_id = v_officer
        and entry.idempotency_key = p_idempotency_key
    ) then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;

    select profile.* into v_student
    from public.profiles as profile
    where profile.id = v_registration.student_user_id;
    insert into public.attendance_ledger (
      seminar_id, registration_id, student_user_id, kind, event_at,
      method, officer_user_id, idempotency_key
    ) values (
      p_seminar_id, v_registration.id, v_student.id, p_kind, v_now,
      'qr', v_officer, p_idempotency_key
    ) returning * into v_entry;

    update public.registrations as registration
    set time_in_at = case when p_kind = 'time_in' then v_now else registration.time_in_at end,
        time_out_at = case when p_kind = 'time_out' then v_now else registration.time_out_at end
    where registration.id = v_registration.id;

    v_response := pg_catalog.jsonb_build_object(
      'entry', pg_catalog.to_jsonb(v_entry) || pg_catalog.jsonb_build_object(
        'officer_name', coalesce((select profile.display_name from public.profiles as profile where profile.id = v_officer), '')
      ),
      'student', pg_catalog.jsonb_build_object(
        'studentId', v_student.student_id,
        'firstName', coalesce(v_student.first_name, ''),
        'lastName', coalesce(v_student.last_name, ''),
        'middleInitial', coalesce(v_student.middle_initial, ''),
        'fullName', concat_ws(' ', nullif(v_student.first_name, ''), nullif(v_student.last_name, '')),
        'program', coalesce(v_student.program, ''),
        'yearLevel', v_student.year_level,
        'block', coalesce(v_student.block, ''),
        'avatarUrl', v_student.avatar_url
      )
    );
    v_outcome := 'success';
    raise log 'attendance_scan outcome=% mode=% duration_ms=% request_id=%',
      v_outcome, v_mode, round(extract(epoch from (pg_catalog.clock_timestamp() - v_started_at)) * 1000, 2), v_request_id;
    return v_response;
  exception when others then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'attendance_ledger_registration_mode_uidx' then
      v_outcome := 'attendance_already_recorded';
    elsif v_constraint_name = 'attendance_ledger_officer_user_id_idempotency_key_key' then
      v_outcome := 'idempotency_conflict';
    else
      v_outcome := case sqlerrm
        when 'session_expired' then 'session_expired'
        when 'validation_failed' then 'validation_failed'
        when 'forbidden' then 'forbidden'
        when 'not_found' then 'not_found'
        when 'registration_inactive' then 'registration_inactive'
        when 'challenge_expired' then 'challenge_expired'
        when 'outside_scan_window' then 'outside_scan_window'
        when 'wrong_attendance_step' then 'wrong_attendance_step'
        when 'attendance_already_recorded' then 'attendance_already_recorded'
        when 'attendance_already_complete' then 'attendance_already_complete'
        when 'challenge_replayed' then 'challenge_replayed'
        when 'idempotency_conflict' then 'idempotency_conflict'
        when 'not_available' then 'not_available'
        else 'server_error'
      end;
    end if;
    raise log 'attendance_scan outcome=% mode=% duration_ms=% request_id=%',
      v_outcome, v_mode, round(extract(epoch from (pg_catalog.clock_timestamp() - v_started_at)) * 1000, 2), v_request_id;

    if v_constraint_name = 'attendance_ledger_registration_mode_uidx' then
      raise exception using errcode = 'P0001', message = 'attendance_already_recorded';
    elsif v_constraint_name = 'attendance_ledger_officer_user_id_idempotency_key_key' then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    raise;
  end;
end;
$$;

revoke all on function public.record_org_challenge_scan(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_org_challenge_scan(uuid, text, uuid, text) to authenticated;

create or replace function public.record_org_scan(
  p_seminar_id uuid,
  p_student_id text,
  p_method text,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
  v_constraint_name text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'session_expired';
  end if;

  select seminar.organization_id into v_organization_id
  from public.seminars as seminar
  where seminar.id = p_seminar_id
    and seminar.publication_status = 'published'
    and seminar.seminar_type = 'seminar';
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform 1
  from public.organization_memberships as membership
  where membership.organization_id = v_organization_id
    and membership.user_id = v_uid
    and membership.status = 'active'
    and membership.role = 'org_member'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if p_method <> 'manual' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  begin
    return private.record_org_scan_unchecked(
      p_seminar_id, p_student_id, p_method, p_reason, p_idempotency_key
    );
  exception when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'attendance_ledger_registration_mode_uidx' then
      raise exception using errcode = 'P0001', message = 'attendance_already_recorded';
    elsif v_constraint_name = 'attendance_ledger_officer_user_id_idempotency_key_key' then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    raise;
  end;
end;
$$;

revoke all on function public.record_org_scan(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_org_scan(uuid, text, text, text, uuid) to authenticated;

create or replace function public.review_webinar_proof(
  p_proof_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.webinar_proofs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
  v_registration_id uuid;
  v_kind text;
  v_registration public.registrations;
  v_constraint_name text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select seminar.organization_id, proof.registration_id, proof.kind
  into v_organization_id, v_registration_id, v_kind
  from public.webinar_proofs as proof
  join public.seminars as seminar on seminar.id = proof.seminar_id
  where proof.id = p_proof_id
    and seminar.publication_status = 'published';
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform 1
  from public.organization_memberships as membership
  where membership.organization_id = v_organization_id
    and membership.user_id = v_uid
    and membership.status = 'active'
    and membership.role = 'org_member'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if p_approve then
    select registration.* into v_registration
    from public.registrations as registration
    where registration.id = v_registration_id
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;
    if exists (
      select 1
      from public.attendance_ledger as ledger
      where ledger.registration_id = v_registration_id
        and ledger.kind = v_kind
    ) then
      raise exception using errcode = 'P0001', message = 'attendance_already_recorded';
    end if;
  end if;

  begin
    return private.review_webinar_proof_unchecked(p_proof_id, p_approve, p_reason);
  exception when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'attendance_ledger_registration_mode_uidx' then
      raise exception using errcode = 'P0001', message = 'attendance_already_recorded';
    elsif v_constraint_name = 'attendance_ledger_officer_user_id_idempotency_key_key' then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    raise;
  end;
end;
$$;

revoke all on function public.review_webinar_proof(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.review_webinar_proof(uuid, boolean, text) to authenticated;
