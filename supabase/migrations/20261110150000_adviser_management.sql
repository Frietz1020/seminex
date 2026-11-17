alter table public.organization_memberships
  add column id uuid not null default gen_random_uuid(),
  add column position text,
  add column appointed_at timestamptz,
  add column endorsed_by uuid references public.profiles (id) on delete set null;

create unique index organization_memberships_id_key
  on public.organization_memberships (id);

update public.organization_memberships as membership
set position = 'Member',
    appointed_at = membership.created_at,
    endorsed_by = null
where membership.role = 'org_member';

update public.organization_memberships as membership
set position = coalesce(nullif(pg_catalog.btrim(request.position), ''), 'Member'),
    endorsed_by = request.decided_by
from (
  select distinct on (access_request.organization_id, access_request.user_id)
    access_request.organization_id,
    access_request.user_id,
    access_request.position,
    access_request.decided_by
  from public.organization_access_requests as access_request
  where access_request.status = 'approved'
  order by access_request.organization_id, access_request.user_id,
    access_request.requested_at desc, access_request.id desc
) as request
where membership.role = 'org_member'
  and request.organization_id = membership.organization_id
  and request.user_id = membership.user_id;

alter table public.organization_memberships
  add constraint organization_memberships_member_metadata_check
    check (
      role <> 'org_member'
      or (
        position is not null
        and pg_catalog.char_length(pg_catalog.btrim(position)) between 1 and 120
        and appointed_at is not null
      )
    );

comment on column public.organization_memberships.id is 'Stable UUID used by adviser directory operations.';
comment on column public.organization_memberships.position is 'Current organization-member position; adviser directory labels are derived.';
comment on column public.organization_memberships.appointed_at is 'Timestamp of the current membership appointment.';
comment on column public.organization_memberships.endorsed_by is 'Adviser who approved the current membership appointment.';

create function public.list_adviser_org_requests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1
    from public.organization_memberships as adviser
    where adviser.user_id = v_uid
      and adviser.role = 'adviser'
      and adviser.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'id', access_request.id,
        'studentId', coalesce(profile.student_id, pg_catalog.split_part(profile.email, '@', 1)),
        'fullName', coalesce(
          nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', profile.first_name, profile.last_name)), ''),
          nullif(pg_catalog.btrim(profile.display_name), ''),
          pg_catalog.split_part(profile.email, '@', 1)
        ),
        'organizationId', access_request.organization_id,
        'position', access_request.position,
        'statement', access_request.statement,
        'requestedAt', access_request.requested_at,
        'status', access_request.status::text,
        'decidedAt', access_request.decided_at,
        'decidedByAdviserId', access_request.decided_by,
        'decisionNote', access_request.decision_note
      ))
      order by access_request.requested_at desc, access_request.id desc
    )
    from public.organization_access_requests as access_request
    join public.profiles as profile on profile.id = access_request.user_id
    where exists (
      select 1
      from public.organization_memberships as adviser
      where adviser.organization_id = access_request.organization_id
        and adviser.user_id = v_uid
        and adviser.role = 'adviser'
        and adviser.status = 'active'
    )
  ), '[]'::jsonb);
end;
$$;

create function public.list_adviser_org_members()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1
    from public.organization_memberships as adviser
    where adviser.user_id = v_uid
      and adviser.role = 'adviser'
      and adviser.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(directory.member order by directory.full_name, directory.membership_id)
    from (
      select
        membership.id as membership_id,
        coalesce(
          nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', profile.first_name, profile.last_name)), ''),
          nullif(pg_catalog.btrim(profile.display_name), ''),
          pg_catalog.split_part(profile.email, '@', 1)
        ) as full_name,
        pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
          'id', membership.id,
          'organizationId', membership.organization_id,
          'fullName', coalesce(
            nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', profile.first_name, profile.last_name)), ''),
            nullif(pg_catalog.btrim(profile.display_name), ''),
            pg_catalog.split_part(profile.email, '@', 1)
          ),
          'email', profile.email,
          'studentId', profile.student_id,
          'position', case when membership.role = 'adviser' then 'Faculty adviser' else membership.position end,
          'status', membership.status::text,
          'appointedAt', case
            when membership.role = 'adviser' then ''
            else membership.appointed_at::text
          end,
          'category', case when membership.role = 'adviser' then 'adviser' else 'member' end
        )) as member
      from public.organization_memberships as membership
      join public.profiles as profile on profile.id = membership.user_id
      where (
        membership.role = 'org_member'
        or (membership.role = 'adviser' and membership.status = 'active')
      )
        and exists (
          select 1
          from public.organization_memberships as assigned_adviser
          where assigned_adviser.organization_id = membership.organization_id
            and assigned_adviser.user_id = v_uid
            and assigned_adviser.role = 'adviser'
            and assigned_adviser.status = 'active'
        )
    ) as directory
  ), '[]'::jsonb);
end;
$$;

create function public.decide_adviser_org_request(
  p_request_id uuid,
  p_decision text,
  p_decision_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.organization_access_requests;
  v_membership public.organization_memberships;
  v_profile public.profiles;
begin
  if v_uid is null or not exists (
    select 1
    from public.organization_memberships as adviser
    where adviser.user_id = v_uid
      and adviser.role = 'adviser'
      and adviser.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select access_request.* into v_request
  from public.organization_access_requests as access_request
  where access_request.id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform 1
  from public.organization_memberships as adviser
  where adviser.organization_id = v_request.organization_id
    and adviser.user_id = v_uid
    and adviser.role = 'adviser'
    and adviser.status = 'active'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  if p_decision = 'approved' then
    select membership.* into v_membership
    from public.organization_memberships as membership
    where membership.organization_id = v_request.organization_id
      and membership.user_id = v_request.user_id
    for update;

    if found then
      if v_membership.role = 'adviser' or v_membership.status = 'active' then
        raise exception using errcode = 'P0001', message = 'conflict';
      end if;

      update public.organization_memberships as membership
      set status = 'active',
          position = pg_catalog.btrim(v_request.position),
          appointed_at = pg_catalog.clock_timestamp(),
          endorsed_by = v_uid
      where membership.organization_id = v_request.organization_id
        and membership.user_id = v_request.user_id;
    else
      insert into public.organization_memberships (
        organization_id, user_id, role, status, position, appointed_at, endorsed_by
      ) values (
        v_request.organization_id, v_request.user_id, 'org_member', 'active',
        pg_catalog.btrim(v_request.position), pg_catalog.clock_timestamp(), v_uid
      );
    end if;
  end if;

  update public.organization_access_requests as access_request
  set status = p_decision::public.organization_request_status,
      decided_at = pg_catalog.clock_timestamp(),
      decided_by = v_uid,
      decision_note = nullif(pg_catalog.btrim(p_decision_note), '')
  where access_request.id = v_request.id
  returning access_request.* into v_request;

  select profile.* into v_profile
  from public.profiles as profile
  where profile.id = v_request.user_id;

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', v_request.id,
    'studentId', coalesce(v_profile.student_id, pg_catalog.split_part(v_profile.email, '@', 1)),
    'fullName', coalesce(
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', v_profile.first_name, v_profile.last_name)), ''),
      nullif(pg_catalog.btrim(v_profile.display_name), ''),
      pg_catalog.split_part(v_profile.email, '@', 1)
    ),
    'organizationId', v_request.organization_id,
    'position', v_request.position,
    'statement', v_request.statement,
    'requestedAt', v_request.requested_at,
    'status', v_request.status::text,
    'decidedAt', v_request.decided_at,
    'decidedByAdviserId', v_request.decided_by,
    'decisionNote', v_request.decision_note
  ));
end;
$$;

create function public.update_adviser_member_position(p_membership_id uuid, p_position text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
  v_membership public.organization_memberships;
  v_profile public.profiles;
  v_position text := pg_catalog.btrim(coalesce(p_position, ''));
begin
  if v_uid is null or not exists (
    select 1
    from public.organization_memberships as adviser
    where adviser.user_id = v_uid
      and adviser.role = 'adviser'
      and adviser.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select membership.organization_id into v_organization_id
  from public.organization_memberships as membership
  where membership.id = p_membership_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform 1
  from public.organization_memberships as adviser
  where adviser.organization_id = v_organization_id
    and adviser.user_id = v_uid
    and adviser.role = 'adviser'
    and adviser.status = 'active'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select membership.* into v_membership
  from public.organization_memberships as membership
  where membership.id = p_membership_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_membership.role <> 'org_member' or v_membership.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  if v_position = '' or pg_catalog.char_length(v_position) > 100 then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  update public.organization_memberships as membership
  set position = v_position
  where membership.id = p_membership_id
  returning membership.* into v_membership;

  select profile.* into v_profile
  from public.profiles as profile
  where profile.id = v_membership.user_id;

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', v_membership.id,
    'organizationId', v_membership.organization_id,
    'fullName', coalesce(
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', v_profile.first_name, v_profile.last_name)), ''),
      nullif(pg_catalog.btrim(v_profile.display_name), ''),
      pg_catalog.split_part(v_profile.email, '@', 1)
    ),
    'email', v_profile.email,
    'studentId', v_profile.student_id,
    'position', v_membership.position,
    'status', v_membership.status::text,
    'appointedAt', v_membership.appointed_at,
    'category', 'member'
  ));
end;
$$;

create function public.remove_adviser_member(p_membership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
  v_membership public.organization_memberships;
  v_profile public.profiles;
begin
  if v_uid is null or not exists (
    select 1
    from public.organization_memberships as adviser
    where adviser.user_id = v_uid
      and adviser.role = 'adviser'
      and adviser.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select membership.organization_id into v_organization_id
  from public.organization_memberships as membership
  where membership.id = p_membership_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform 1
  from public.organization_memberships as adviser
  where adviser.organization_id = v_organization_id
    and adviser.user_id = v_uid
    and adviser.role = 'adviser'
    and adviser.status = 'active'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select membership.* into v_membership
  from public.organization_memberships as membership
  where membership.id = p_membership_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_membership.role <> 'org_member' or v_membership.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;

  update public.organization_memberships as membership
  set status = 'removed'
  where membership.id = p_membership_id
  returning membership.* into v_membership;

  select profile.* into v_profile
  from public.profiles as profile
  where profile.id = v_membership.user_id;

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', v_membership.id,
    'organizationId', v_membership.organization_id,
    'fullName', coalesce(
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', v_profile.first_name, v_profile.last_name)), ''),
      nullif(pg_catalog.btrim(v_profile.display_name), ''),
      pg_catalog.split_part(v_profile.email, '@', 1)
    ),
    'email', v_profile.email,
    'studentId', v_profile.student_id,
    'position', v_membership.position,
    'status', v_membership.status::text,
    'appointedAt', v_membership.appointed_at,
    'category', 'member'
  ));
end;
$$;

revoke all on function public.list_adviser_org_requests() from public, anon, authenticated;
revoke all on function public.list_adviser_org_members() from public, anon, authenticated;
revoke all on function public.decide_adviser_org_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_adviser_member_position(uuid, text) from public, anon, authenticated;
revoke all on function public.remove_adviser_member(uuid) from public, anon, authenticated;

grant execute on function public.list_adviser_org_requests() to authenticated;
grant execute on function public.list_adviser_org_members() to authenticated;
grant execute on function public.decide_adviser_org_request(uuid, text, text) to authenticated;
grant execute on function public.update_adviser_member_position(uuid, text) to authenticated;
grant execute on function public.remove_adviser_member(uuid) to authenticated;
