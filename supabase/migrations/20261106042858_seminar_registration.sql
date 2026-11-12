-- Seminar and registration storage. MOCK data remains independent in src/api.
create table public.seminars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  reference text not null unique default ('SEM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  title text not null default '' check (length(title) <= 180),
  description text not null default '' check (length(description) <= 5000),
  overview text check (overview is null or length(overview) <= 12000),
  objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array'),
  seminar_type text not null default 'seminar' check (seminar_type in ('seminar', 'webinar')),
  speaker_name text not null default '' check (length(speaker_name) <= 180),
  speaker_role text not null default '' check (length(speaker_role) <= 180),
  venue text not null default '' check (length(venue) <= 300),
  venue_guidelines text check (venue_guidelines is null or length(venue_guidelines) <= 5000),
  department text not null default '' check (length(department) <= 180),
  topics text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer not null default 1 check (capacity >= 1),
  registered_count integer not null default 0 check (registered_count between 0 and capacity),
  required_attendance_percent integer not null default 60 check (required_attendance_percent between 1 and 100),
  confirmation_opens_hours_before integer not null default 24 check (confirmation_opens_hours_before >= 2),
  confirmation_closes_hours_before integer not null default 1 check (confirmation_closes_hours_before >= 1),
  -- This column is intentionally not granted to anon or authenticated roles.
  join_url text check (join_url is null or join_url ~* '^https://'),
  image_url text check (image_url is null or length(image_url) <= 2048),
  curriculum_credit text check (curriculum_credit is null or length(curriculum_credit) <= 300),
  organizing_body text check (organizing_body is null or length(organizing_body) <= 300),
  certificate_eligibility text check (certificate_eligibility is null or length(certificate_eligibility) <= 1000),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published', 'cancelled', 'archived')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint seminars_confirmation_window_check check (confirmation_opens_hours_before > confirmation_closes_hours_before),
  constraint seminars_schedule_order_check check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint seminars_published_readiness_check check (
    publication_status <> 'published'
    or (
      length(trim(title)) > 0
      and length(trim(description)) > 0
      and length(trim(speaker_name)) > 0
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
      and published_at is not null
      and (
        (seminar_type = 'webinar' and join_url ~* '^https://')
        or (seminar_type = 'seminar' and length(trim(venue)) > 0)
      )
    )
  ),
  unique (id, organization_id)
);

create index seminars_catalog_status_start_idx
  on public.seminars (starts_at, id)
  where publication_status = 'published';
create index seminars_organization_status_start_idx
  on public.seminars (organization_id, publication_status, starts_at desc);

create table public.seminar_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  editing_seminar_id uuid,
  published_seminar_id uuid unique references public.seminars (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  certificate_template jsonb check (certificate_template is null or jsonb_typeof(certificate_template) = 'object'),
  survey_definition jsonb check (survey_definition is null or jsonb_typeof(survey_definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seminar_drafts_editing_seminar_same_org_fk
    foreign key (editing_seminar_id, organization_id)
    references public.seminars (id, organization_id)
    on delete set null (editing_seminar_id)
);

create index seminar_drafts_organization_updated_idx
  on public.seminar_drafts (organization_id, updated_at desc);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  student_user_id uuid not null references public.profiles (id) on delete restrict,
  reference text not null unique default ('TKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  status text not null default 'registered' check (status in ('registered', 'confirmed', 'released', 'cancelled')),
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  attendance_ack_at timestamptz,
  -- Projection fields updated by the later append-only attendance transition functions.
  time_in_at timestamptz,
  time_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seminar_id, student_user_id),
  constraint registrations_confirmed_timestamp_check check (status <> 'confirmed' or confirmed_at is not null)
);

create index registrations_student_status_idx
  on public.registrations (student_user_id, status, registered_at desc);
create index registrations_seminar_status_idx
  on public.registrations (seminar_id, status, registered_at);

create view public.registration_read_model
with (security_invoker = true)
as
select
  registration.id,
  registration.seminar_id,
  registration.student_user_id,
  registration.reference,
  case
    when registration.status = 'registered'
      and registration.confirmed_at is null
      and seminar.starts_at is not null
      and pg_catalog.now() >= seminar.starts_at - pg_catalog.make_interval(hours => seminar.confirmation_closes_hours_before)
      then 'released'
    else registration.status
  end as status,
  registration.registered_at,
  registration.confirmed_at,
  registration.attendance_ack_at,
  registration.time_in_at,
  registration.time_out_at,
  seminar.ends_at as seminar_ends_at,
  registration.created_at,
  registration.updated_at
from public.registrations as registration
join public.seminars as seminar on seminar.id = registration.seminar_id;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create function private.sync_seminar_registered_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_active boolean := false;
  v_new_active boolean := false;
  v_seminar_id uuid;
  v_delta integer;
begin
  if tg_op = 'UPDATE' and old.seminar_id is distinct from new.seminar_id then
    raise exception using errcode = 'P0001', message = 'registration_seminar_immutable';
  end if;

  if tg_op <> 'INSERT' then
    v_old_active := old.status in ('registered', 'confirmed');
  end if;
  if tg_op <> 'DELETE' then
    v_new_active := new.status in ('registered', 'confirmed');
  end if;

  if tg_op = 'INSERT' then
    v_seminar_id := new.seminar_id;
    v_delta := case when v_new_active then 1 else 0 end;
  elsif tg_op = 'DELETE' then
    v_seminar_id := old.seminar_id;
    v_delta := case when v_old_active then -1 else 0 end;
  else
    v_seminar_id := new.seminar_id;
    v_delta := case when v_old_active then -1 else 0 end
      + case when v_new_active then 1 else 0 end;
  end if;

  if v_delta <> 0 then
    update public.seminars as seminar
    set registered_count = seminar.registered_count + v_delta
    where seminar.id = v_seminar_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_seminar_registered_count() from public, anon, authenticated;

create trigger seminars_set_updated_at
  before update on public.seminars
  for each row execute function private.set_updated_at();
create trigger seminar_drafts_set_updated_at
  before update on public.seminar_drafts
  for each row execute function private.set_updated_at();
create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function private.set_updated_at();
create trigger registrations_sync_seminar_registered_count
  after insert or update of seminar_id, status or delete on public.registrations
  for each row execute function private.sync_seminar_registered_count();

alter table public.seminars enable row level security;
alter table public.seminar_drafts enable row level security;
alter table public.registrations enable row level security;

revoke all on public.seminars, public.seminar_drafts, public.registrations from public, anon, authenticated;

grant select (
  id, organization_id, reference, title, description, overview, objectives,
  seminar_type, speaker_name, speaker_role, venue, venue_guidelines, department,
  topics, starts_at, ends_at, capacity, registered_count, required_attendance_percent,
  confirmation_opens_hours_before, confirmation_closes_hours_before, image_url,
  curriculum_credit, organizing_body, certificate_eligibility, publication_status,
  published_at
) on public.seminars to anon, authenticated;

grant select, delete on public.seminar_drafts to authenticated;
grant insert (organization_id, editing_seminar_id, created_by, details, certificate_template, survey_definition)
  on public.seminar_drafts to authenticated;
grant update (editing_seminar_id, details, certificate_template, survey_definition)
  on public.seminar_drafts to authenticated;
grant select on public.registrations to authenticated;
grant select on public.registration_read_model to authenticated;

create policy "Anyone can read published seminar catalog rows"
  on public.seminars for select to anon
  using (publication_status = 'published');

create policy "Users can read published or organization-owned seminars"
  on public.seminars for select to authenticated
  using (
    publication_status = 'published'
    or exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminars.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy "Active organization members read their seminar drafts"
  on public.seminar_drafts for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy "Active organization members create their seminar drafts"
  on public.seminar_drafts for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and published_seminar_id is null
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy "Active organization members update their seminar drafts"
  on public.seminar_drafts for update to authenticated
  using (
    published_seminar_id is null
    and
    exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  )
  with check (
    published_seminar_id is null
    and
    exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy "Active organization members delete their seminar drafts"
  on public.seminar_drafts for delete to authenticated
  using (
    published_seminar_id is null
    and
    exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create policy "Students and organization members can read permitted registrations"
  on public.registrations for select to authenticated
  using (
    student_user_id = (select auth.uid())
    or exists (
      select 1
      from public.seminars as seminar
      join public.organization_memberships as membership
        on membership.organization_id = seminar.organization_id
      where seminar.id = registrations.seminar_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create function private.release_expired_registrations(p_seminar_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released_count integer;
  v_seminar_id uuid;
  v_registration_id uuid;
  v_close_at timestamptz;
begin
  v_released_count := 0;

  for v_seminar_id in
    select seminar.id
    from public.seminars as seminar
    where (p_seminar_id is null or seminar.id = p_seminar_id)
      and exists (
        select 1
        from public.registrations as registration
        where registration.seminar_id = seminar.id
          and registration.status = 'registered'
          and registration.confirmed_at is null
      )
    order by seminar.id
  loop
    perform 1
    from public.seminars as seminar
    where seminar.id = v_seminar_id
    for update;

    for v_registration_id, v_close_at in
      select registration.id,
        seminar.starts_at - pg_catalog.make_interval(hours => seminar.confirmation_closes_hours_before)
      from public.registrations as registration
      join public.seminars as seminar on seminar.id = registration.seminar_id
      where registration.seminar_id = v_seminar_id
        and registration.status = 'registered'
        and registration.confirmed_at is null
        and seminar.starts_at is not null
        and pg_catalog.clock_timestamp() >= seminar.starts_at - pg_catalog.make_interval(hours => seminar.confirmation_closes_hours_before)
      for update of registration
    loop
      if pg_catalog.clock_timestamp() >= v_close_at then
        update public.registrations as registration
        set status = 'released'
        where registration.id = v_registration_id
          and registration.status = 'registered'
          and registration.confirmed_at is null;

        if found then
          v_released_count := v_released_count + 1;
        end if;
      end if;
    end loop;
  end loop;

  return v_released_count;
end;
$$;

revoke all on function private.release_expired_registrations(uuid) from public, anon, authenticated;

create function public.publish_seminar(p_draft_id uuid)
returns public.seminars
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.seminar_drafts;
  v_seminar public.seminars;
  v_uid uuid := auth.uid();
  v_seminar_type text;
  v_title text;
  v_description text;
  v_overview text;
  v_objectives jsonb;
  v_speaker_name text;
  v_speaker_role text;
  v_venue text;
  v_venue_guidelines text;
  v_department text;
  v_topics text[];
  v_image_url text;
  v_curriculum_credit text;
  v_organizing_body text;
  v_certificate_eligibility text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_capacity integer;
  v_attendance_percent integer;
  v_confirmation_opens integer;
  v_confirmation_closes integer;
  v_join_url text;
  v_active_count integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select draft.* into v_draft
  from public.seminar_drafts as draft
  where draft.id = p_draft_id
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = draft.organization_id
        and membership.user_id = v_uid
        and membership.status = 'active'
        and membership.role in ('org_member', 'adviser')
    )
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  if v_draft.certificate_template is null
    or v_draft.survey_definition is null
    or not pg_catalog.jsonb_path_exists(v_draft.survey_definition, '$.sections[*].questions[*]') then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_seminar_type := coalesce(v_draft.details ->> 'seminarType', 'seminar');
  v_title := pg_catalog.btrim(coalesce(v_draft.details ->> 'title', ''));
  v_description := pg_catalog.btrim(coalesce(v_draft.details ->> 'description', ''));
  v_overview := nullif(pg_catalog.btrim(v_draft.details ->> 'overview'), '');
  v_objectives := coalesce(v_draft.details -> 'objectives', '[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_objectives) <> 'array'
    or pg_catalog.jsonb_typeof(coalesce(v_draft.details -> 'topics', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  v_speaker_name := pg_catalog.btrim(coalesce(v_draft.details ->> 'speakerName', ''));
  v_speaker_role := pg_catalog.btrim(coalesce(v_draft.details ->> 'speakerRole', ''));
  v_venue := pg_catalog.btrim(coalesce(v_draft.details ->> 'venue', ''));
  v_venue_guidelines := nullif(pg_catalog.btrim(v_draft.details ->> 'venueGuidelines'), '');
  v_department := pg_catalog.btrim(coalesce(v_draft.details ->> 'department', ''));
  v_topics := array(select jsonb_array_elements_text(coalesce(v_draft.details -> 'topics', '[]'::jsonb)));
  v_image_url := nullif(pg_catalog.btrim(v_draft.details ->> 'coverImageUrl'), '');
  v_curriculum_credit := nullif(pg_catalog.btrim(v_draft.details ->> 'curriculumCredit'), '');
  v_organizing_body := nullif(pg_catalog.btrim(v_draft.details ->> 'organizingBody'), '');
  v_certificate_eligibility := nullif(pg_catalog.btrim(v_draft.details ->> 'certificateEligibility'), '');
  v_join_url := nullif(pg_catalog.btrim(v_draft.details ->> 'joinUrl'), '');

  begin
    v_starts_at := nullif(v_draft.details ->> 'startsAt', '')::timestamptz;
    v_ends_at := nullif(v_draft.details ->> 'endsAt', '')::timestamptz;
    v_capacity := nullif(v_draft.details ->> 'capacity', '')::integer;
    v_attendance_percent := coalesce(nullif(v_draft.details ->> 'requiredAttendancePercent', '')::integer, 60);
    v_confirmation_opens := coalesce(nullif(v_draft.details ->> 'confirmationOpensHoursBefore', '')::integer, 24);
    v_confirmation_closes := coalesce(nullif(v_draft.details ->> 'confirmationClosesHoursBefore', '')::integer, 1);
  exception
    when invalid_datetime_format or invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'validation_failed';
  end;

  if v_seminar_type not in ('seminar', 'webinar')
    or v_title = ''
    or v_description = ''
    or v_speaker_name = ''
    or pg_catalog.length(v_title) > 180
    or pg_catalog.length(v_description) > 5000
    or pg_catalog.length(coalesce(v_overview, '')) > 12000
    or pg_catalog.length(v_speaker_name) > 180
    or pg_catalog.length(v_speaker_role) > 180
    or pg_catalog.length(v_venue) > 300
    or pg_catalog.length(coalesce(v_venue_guidelines, '')) > 5000
    or pg_catalog.length(v_department) > 180
    or pg_catalog.length(coalesce(v_image_url, '')) > 2048
    or pg_catalog.length(coalesce(v_curriculum_credit, '')) > 300
    or pg_catalog.length(coalesce(v_organizing_body, '')) > 300
    or pg_catalog.length(coalesce(v_certificate_eligibility, '')) > 1000
    or v_starts_at is null
    or v_ends_at is null
    or v_ends_at <= v_starts_at
    or v_capacity is null
    or v_capacity < 1
    or v_attendance_percent not between 1 and 100
    or v_confirmation_opens <= v_confirmation_closes
    or v_confirmation_closes < 1
    or (v_seminar_type = 'webinar' and (v_join_url is null or v_join_url !~* '^https://[^/[:space:]]+'))
    or (v_seminar_type = 'seminar' and v_venue = '') then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  if v_draft.editing_seminar_id is not null then
    select seminar.* into v_seminar
    from public.seminars as seminar
    where seminar.id = v_draft.editing_seminar_id
      and seminar.organization_id = v_draft.organization_id
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;

    perform private.release_expired_registrations(v_draft.editing_seminar_id);

    select count(*)::integer into v_active_count
    from public.registrations as registration
    where registration.seminar_id = v_draft.editing_seminar_id
      and registration.status in ('registered', 'confirmed');

    if v_capacity < v_active_count then
      raise exception using errcode = 'P0001', message = 'validation_failed';
    end if;

    update public.seminars as seminar
    set title = v_title,
        description = v_description,
        overview = v_overview,
        objectives = v_objectives,
        seminar_type = v_seminar_type,
        speaker_name = v_speaker_name,
        speaker_role = v_speaker_role,
        venue = v_venue,
        venue_guidelines = v_venue_guidelines,
        department = v_department,
        topics = v_topics,
        starts_at = v_starts_at,
        ends_at = v_ends_at,
        capacity = v_capacity,
        required_attendance_percent = v_attendance_percent,
        confirmation_opens_hours_before = v_confirmation_opens,
        confirmation_closes_hours_before = v_confirmation_closes,
        join_url = v_join_url,
        image_url = v_image_url,
        curriculum_credit = v_curriculum_credit,
        organizing_body = v_organizing_body,
        certificate_eligibility = v_certificate_eligibility,
        publication_status = 'published',
        published_at = coalesce(seminar.published_at, pg_catalog.clock_timestamp())
    where seminar.id = v_draft.editing_seminar_id
      and seminar.organization_id = v_draft.organization_id
      and seminar.publication_status not in ('cancelled', 'archived')
    returning seminar.* into v_seminar;

    if not found then
      raise exception using errcode = 'P0001', message = 'not_available';
    end if;
  else
    insert into public.seminars (
      organization_id, reference, title, description, overview, objectives, seminar_type, speaker_name, speaker_role,
      venue, venue_guidelines, department, topics, starts_at, ends_at, capacity, required_attendance_percent,
      confirmation_opens_hours_before, confirmation_closes_hours_before, join_url,
      image_url, curriculum_credit, organizing_body, certificate_eligibility,
      publication_status, created_by, published_at
    )
    values (
      v_draft.organization_id,
      'SEM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      v_title, v_description, v_overview, v_objectives, v_seminar_type, v_speaker_name, v_speaker_role,
      v_venue, v_venue_guidelines, v_department, v_topics, v_starts_at, v_ends_at, v_capacity, v_attendance_percent,
      v_confirmation_opens, v_confirmation_closes, v_join_url,
      v_image_url, v_curriculum_credit, v_organizing_body, v_certificate_eligibility,
      'published', v_uid, pg_catalog.clock_timestamp()
    )
    returning * into v_seminar;
  end if;

  delete from public.seminar_drafts as draft
  where draft.published_seminar_id = v_seminar.id
    and draft.id <> v_draft.id;

  update public.seminar_drafts as draft
  set published_seminar_id = v_seminar.id
  where draft.id = v_draft.id;

  return v_seminar;
exception
  when check_violation or string_data_right_truncation then
    raise exception using errcode = 'P0001', message = 'validation_failed';
end;
$$;

create function public.create_org_edit_draft(p_seminar_id uuid)
returns public.seminar_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_source public.seminar_drafts;
  v_draft public.seminar_drafts;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select source.* into v_source
  from public.seminar_drafts as source
  join public.seminars as seminar on seminar.id = source.published_seminar_id
  where source.published_seminar_id = p_seminar_id
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar.organization_id
        and membership.user_id = v_uid
        and membership.status = 'active'
        and membership.role in ('org_member', 'adviser')
    )
  for share of source;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  insert into public.seminar_drafts (
    organization_id, editing_seminar_id, created_by, details, certificate_template, survey_definition
  )
  values (
    v_source.organization_id,
    p_seminar_id,
    v_uid,
    v_source.details,
    v_source.certificate_template,
    v_source.survey_definition
  )
  returning * into v_draft;

  return v_draft;
end;
$$;

create function public.get_webinar_join_url(p_seminar_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_join_url text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select seminar.join_url into v_join_url
  from public.seminars as seminar
  join public.registrations as registration
    on registration.seminar_id = seminar.id
   and registration.student_user_id = v_uid
   and registration.status = 'confirmed'
  where seminar.id = p_seminar_id
    and seminar.seminar_type = 'webinar'
    and seminar.publication_status = 'published'
    and pg_catalog.clock_timestamp() >= seminar.starts_at - interval '1 hour'
    and pg_catalog.clock_timestamp() < seminar.ends_at;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  return v_join_url;
end;
$$;

revoke all on function public.create_org_edit_draft(uuid) from public, anon;
revoke all on function public.get_webinar_join_url(uuid) from public, anon;
grant execute on function public.create_org_edit_draft(uuid) to authenticated;
grant execute on function public.get_webinar_join_url(uuid) to authenticated;

create function public.register_for_seminar(p_seminar_id uuid)
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
  v_closes_at timestamptz;
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

  v_opens_at := v_seminar.starts_at - pg_catalog.make_interval(hours => v_seminar.confirmation_opens_hours_before);
  v_closes_at := v_seminar.starts_at - pg_catalog.make_interval(hours => v_seminar.confirmation_closes_hours_before);

  if v_has_registration then
    update public.registrations as registration
    set status = case when v_now >= v_opens_at and v_now < v_closes_at then 'confirmed' else 'registered' end,
        registered_at = v_now,
        confirmed_at = case when v_now >= v_opens_at and v_now < v_closes_at then v_now else null end,
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
      case when v_now >= v_opens_at and v_now < v_closes_at then 'confirmed' else 'registered' end,
      v_now,
      case when v_now >= v_opens_at and v_now < v_closes_at then v_now else null end
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

create function public.confirm_registration(p_seminar_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seminar public.seminars;
  v_registration public.registrations;
  v_now timestamptz;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
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
  if v_seminar.publication_status <> 'published' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  perform private.release_expired_registrations(p_seminar_id);

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_registration.status = 'confirmed' then
    return v_registration;
  end if;
  if v_registration.status <> 'registered' then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_opens_at := v_seminar.starts_at - pg_catalog.make_interval(hours => v_seminar.confirmation_opens_hours_before);
  v_closes_at := v_seminar.starts_at - pg_catalog.make_interval(hours => v_seminar.confirmation_closes_hours_before);
  if v_now < v_opens_at or v_now >= v_closes_at then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  update public.registrations as registration
  set status = 'confirmed', confirmed_at = v_now
  where registration.id = v_registration.id
  returning registration.* into v_registration;
  return v_registration;
end;
$$;

create function public.cancel_registration(p_seminar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_registration public.registrations;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and student_id is not null) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  perform 1 from public.seminars where id = p_seminar_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  perform private.release_expired_registrations(p_seminar_id);

  select registration.* into v_registration
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_registration.status not in ('registered', 'confirmed') or v_registration.time_in_at is not null then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;

  update public.registrations as registration
  set status = 'cancelled'
  where registration.id = v_registration.id;
end;
$$;

revoke all on function public.publish_seminar(uuid) from public, anon, authenticated;
revoke all on function public.register_for_seminar(uuid) from public, anon, authenticated;
revoke all on function public.confirm_registration(uuid) from public, anon, authenticated;
revoke all on function public.cancel_registration(uuid) from public, anon, authenticated;
grant execute on function public.publish_seminar(uuid) to authenticated;
grant execute on function public.register_for_seminar(uuid) to authenticated;
grant execute on function public.confirm_registration(uuid) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'seminex-release-expired-registrations',
  '* * * * *',
  'select private.release_expired_registrations(null)'
);
