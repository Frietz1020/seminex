alter table public.registrations
  add column evaluation_submitted_at timestamptz;

create table public.seminar_survey_versions (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  version integer not null check (version >= 1),
  source_survey_id text not null check (length(source_survey_id) between 1 and 120),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (seminar_id, version),
  unique (seminar_id, id)
);

create index seminar_survey_versions_created_idx
  on public.seminar_survey_versions (seminar_id, version desc);

create table public.evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars (id) on delete restrict,
  registration_id uuid not null unique references public.registrations (id) on delete restrict,
  student_user_id uuid not null references public.profiles (id) on delete restrict,
  survey_version_id uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key (seminar_id, survey_version_id)
    references public.seminar_survey_versions (seminar_id, id) on delete restrict
);

create index evaluation_responses_seminar_page_idx
  on public.evaluation_responses (seminar_id, submitted_at, id);
create index evaluation_responses_student_submitted_idx
  on public.evaluation_responses (student_user_id, submitted_at desc);
create index evaluation_responses_survey_version_idx
  on public.evaluation_responses (survey_version_id, submitted_at, id);

alter table public.seminar_survey_versions enable row level security;
alter table public.evaluation_responses enable row level security;
revoke all on public.seminar_survey_versions, public.evaluation_responses from public, anon, authenticated;

create function private.prevent_evaluation_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'evaluation_history_immutable';
end;
$$;
revoke all on function private.prevent_evaluation_history_mutation() from public, anon, authenticated;

create trigger seminar_survey_versions_immutable
  before update or delete on public.seminar_survey_versions
  for each row execute function private.prevent_evaluation_history_mutation();
create trigger evaluation_responses_immutable
  before update or delete on public.evaluation_responses
  for each row execute function private.prevent_evaluation_history_mutation();

create function private.valid_survey_definition(p_definition jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_question jsonb;
  v_question_id text;
  v_question_count integer := 0;
  v_id_count integer;
begin
  if pg_catalog.jsonb_typeof(p_definition) <> 'object'
    or pg_catalog.jsonb_typeof(p_definition -> 'sections') <> 'array'
    or pg_catalog.jsonb_typeof(p_definition -> 'id') <> 'string'
    or pg_catalog.length(p_definition ->> 'id') not between 1 and 120 then
    return false;
  end if;

  for v_question in
    select question.value
    from pg_catalog.jsonb_array_elements(p_definition -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'questions') as question(value)
  loop
    v_question_count := v_question_count + 1;
    if pg_catalog.jsonb_typeof(v_question) <> 'object'
      or pg_catalog.jsonb_typeof(v_question -> 'id') <> 'string'
      or pg_catalog.length(v_question ->> 'id') not between 1 and 120
      or pg_catalog.jsonb_typeof(v_question -> 'prompt') <> 'string'
      or pg_catalog.jsonb_typeof(v_question -> 'required') <> 'boolean'
      or v_question ->> 'type' not in ('scale', 'rating', 'choice', 'checkbox', 'paragraph') then
      return false;
    end if;

    v_question_id := v_question ->> 'id';
    select count(*) into v_id_count
    from pg_catalog.jsonb_array_elements(p_definition -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'questions') as question(value)
    where question.value ->> 'id' = v_question_id;
    if v_id_count <> 1 then return false; end if;

    if v_question ->> 'type' in ('choice', 'checkbox')
      and (pg_catalog.jsonb_typeof(v_question -> 'options') <> 'array'
        or pg_catalog.jsonb_array_length(v_question -> 'options') < 1) then
      return false;
    end if;
    if v_question ->> 'type' = 'scale'
      and (pg_catalog.jsonb_typeof(v_question -> 'min') <> 'number'
        or pg_catalog.jsonb_typeof(v_question -> 'max') <> 'number'
        or (v_question ->> 'min')::integer >= (v_question ->> 'max')::integer) then
      return false;
    end if;
    if v_question ->> 'type' = 'rating'
      and (pg_catalog.jsonb_typeof(v_question -> 'max') <> 'number'
        or (v_question ->> 'max')::integer < 1) then
      return false;
    end if;
    if v_question ->> 'type' = 'paragraph'
      and (pg_catalog.jsonb_typeof(v_question -> 'maxLength') <> 'number'
        or (v_question ->> 'maxLength')::integer < 1
        or (v_question ->> 'maxLength')::integer > 10000) then
      return false;
    end if;
  end loop;

  return v_question_count > 0;
exception when others then
  return false;
end;
$$;
revoke all on function private.valid_survey_definition(jsonb) from public, anon, authenticated;

create function private.snapshot_published_survey()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest public.seminar_survey_versions;
  v_semantic_definition jsonb;
  v_definition jsonb;
  v_version integer;
  v_survey_id text;
begin
  if new.published_seminar_id is null or new.survey_definition is null then
    return new;
  end if;

  if not private.valid_survey_definition(new.survey_definition) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  v_survey_id := new.survey_definition ->> 'id';
  v_semantic_definition := new.survey_definition - 'version' - 'seminarId';
  select version_row.* into v_latest
  from public.seminar_survey_versions as version_row
  where version_row.seminar_id = new.published_seminar_id
  order by version_row.version desc
  limit 1;

  if found and v_latest.source_survey_id = v_survey_id
    and (v_latest.definition - 'version' - 'seminarId') = v_semantic_definition then
    return new;
  end if;

  v_version := coalesce(v_latest.version, 0) + 1;
  v_definition := pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(new.survey_definition, '{seminarId}', pg_catalog.to_jsonb(new.published_seminar_id::text), true),
    '{version}', pg_catalog.to_jsonb(v_version), true
  );

  insert into public.seminar_survey_versions (seminar_id, version, source_survey_id, definition, created_by)
  values (new.published_seminar_id, v_version, v_survey_id, v_definition, new.created_by);
  return new;
end;
$$;
revoke all on function private.snapshot_published_survey() from public, anon, authenticated;

create trigger seminar_drafts_snapshot_published_survey
  after update of published_seminar_id on public.seminar_drafts
  for each row execute function private.snapshot_published_survey();

create function private.is_evaluation_eligible(p_registration_id uuid, p_at timestamptz default pg_catalog.clock_timestamp())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    registration.status in ('registered', 'confirmed')
    and registration.time_in_at is not null
    and registration.time_out_at is not null
    and seminar.starts_at is not null
    and seminar.ends_at is not null
    and seminar.ends_at > seminar.starts_at
    and pg_catalog.floor(extract(epoch from (registration.time_out_at - registration.time_in_at)) / 60)
      >= pg_catalog.ceil(
        pg_catalog.round(extract(epoch from (seminar.ends_at - seminar.starts_at)) / 60)
        * seminar.required_attendance_percent / 100.0
      ),
    false
  )
  from public.registrations as registration
  join public.seminars as seminar on seminar.id = registration.seminar_id
  where registration.id = p_registration_id
    and (seminar.publication_status = 'published' or seminar.publication_status = 'archived')
    and p_at is not null;
$$;
revoke all on function private.is_evaluation_eligible(uuid, timestamptz) from public, anon, authenticated;

create function private.sync_evaluation_submitted_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.registrations as registration
  set evaluation_submitted_at = new.submitted_at
  where registration.id = new.registration_id
    and registration.evaluation_submitted_at is null;
  return new;
end;
$$;
revoke all on function private.sync_evaluation_submitted_at() from public, anon, authenticated;
create trigger evaluation_responses_sync_registration
  after insert on public.evaluation_responses
  for each row execute function private.sync_evaluation_submitted_at();

create or replace view public.registration_read_model
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
  registration.updated_at,
  registration.evaluation_submitted_at
from public.registrations as registration
join public.seminars as seminar on seminar.id = registration.seminar_id;

create function public.list_evaluations_due()
returns table (seminar_id uuid, seminar_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select seminar.id, seminar.title
  from public.registrations as registration
  join public.seminars as seminar on seminar.id = registration.seminar_id
  where registration.student_user_id = (select auth.uid())
    and private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp())
    and registration.evaluation_submitted_at is null
  order by seminar.ends_at desc, seminar.id;
$$;
revoke all on function public.list_evaluations_due() from public, anon;
grant execute on function public.list_evaluations_due() to authenticated;

create function public.get_evaluation_survey(p_seminar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_registration_id uuid;
  v_definition jsonb;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  select registration.id into v_registration_id
  from public.registrations as registration
  where registration.seminar_id = p_seminar_id
    and registration.student_user_id = v_uid
    and private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp());
  if not found then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  if exists (select 1 from public.evaluation_responses response where response.registration_id = v_registration_id) then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  select version_row.definition into v_definition
  from public.seminar_survey_versions as version_row
  where version_row.seminar_id = p_seminar_id
  order by version_row.version desc limit 1;
  if v_definition is null then raise exception using errcode = 'P0001', message = 'not_available'; end if;
  return v_definition;
end;
$$;
revoke all on function public.get_evaluation_survey(uuid) from public, anon;
grant execute on function public.get_evaluation_survey(uuid) to authenticated;

create function private.valid_evaluation_answers(p_definition jsonb, p_answers jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_question jsonb;
  v_question_id text;
  v_answer text;
  v_number numeric;
  v_checkbox jsonb;
  v_count integer;
  v_distinct_count integer;
begin
  if pg_catalog.jsonb_typeof(p_answers) <> 'object' or pg_catalog.pg_column_size(p_answers) > 100000 then
    return false;
  end if;

  for v_question in
    select question.value
    from pg_catalog.jsonb_array_elements(p_definition -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'questions') as question(value)
  loop
    v_question_id := v_question ->> 'id';
    if not (p_answers ? v_question_id) then
      if coalesce((v_question ->> 'required')::boolean, false) then return false; end if;
      continue;
    end if;
    if pg_catalog.jsonb_typeof(p_answers -> v_question_id) <> 'string' then return false; end if;
    v_answer := p_answers ->> v_question_id;
    if coalesce((v_question ->> 'required')::boolean, false) and pg_catalog.btrim(v_answer) = '' then return false; end if;

    if v_question ->> 'type' in ('scale', 'rating') then
      if pg_catalog.length(v_answer) > 10 or v_answer !~ '^-?[0-9]+$' then return false; end if;
      v_number := v_answer::numeric;
      if v_question ->> 'type' = 'scale'
        and (v_number < (v_question ->> 'min')::numeric or v_number > (v_question ->> 'max')::numeric) then return false; end if;
      if v_question ->> 'type' = 'rating'
        and (v_number < 1 or v_number > (v_question ->> 'max')::numeric) then return false; end if;
    elsif v_question ->> 'type' = 'choice' then
      if not exists (select 1 from pg_catalog.jsonb_array_elements(v_question -> 'options') option(value) where option.value ->> 'value' = v_answer) then
        return false;
      end if;
    elsif v_question ->> 'type' = 'checkbox' then
      begin v_checkbox := v_answer::jsonb; exception when others then return false; end;
      if pg_catalog.jsonb_typeof(v_checkbox) <> 'array' then return false; end if;
      select count(*), count(distinct selected.value #>> '{}') into v_count, v_distinct_count
      from pg_catalog.jsonb_array_elements(v_checkbox) selected(value);
      if exists (
        select 1 from pg_catalog.jsonb_array_elements(v_checkbox) selected(value)
        where pg_catalog.jsonb_typeof(selected.value) <> 'string'
          or not exists (select 1 from pg_catalog.jsonb_array_elements(v_question -> 'options') option(value) where option.value ->> 'value' = selected.value #>> '{}')
      ) then return false; end if;
      if v_distinct_count <> pg_catalog.jsonb_array_length(v_checkbox) then return false; end if;
    elsif v_question ->> 'type' = 'paragraph' then
      if pg_catalog.length(v_answer) > (v_question ->> 'maxLength')::integer then return false; end if;
    else
      return false;
    end if;
  end loop;

  if (select count(*) from pg_catalog.jsonb_object_keys(p_answers)) <> (
    select count(*)
    from pg_catalog.jsonb_array_elements(p_definition -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'questions') as question(value)
    where p_answers ? (question.value ->> 'id')
  ) then return false; end if;
  return true;
exception when others then
  return false;
end;
$$;
revoke all on function private.valid_evaluation_answers(jsonb, jsonb) from public, anon, authenticated;

create function public.submit_evaluation(p_seminar_id uuid, p_survey_id text, p_survey_version integer, p_answers jsonb)
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
      return pg_catalog.jsonb_build_object('submittedAt', v_existing.submitted_at);
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
  return pg_catalog.jsonb_build_object('submittedAt', v_response.submitted_at);
end;
$$;
revoke all on function public.submit_evaluation(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.submit_evaluation(uuid, text, integer, jsonb) to authenticated;

create function private.evaluation_question_aggregates(p_version_id uuid, p_definition jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_question jsonb;
  v_type text;
  v_response_count integer;
  v_mean numeric;
  v_option jsonb;
  v_value text;
  v_label text;
  v_count integer;
  v_distribution jsonb;
  v_comments jsonb;
  v_questions jsonb := '[]'::jsonb;
  v_question_aggregate jsonb;
  v_number integer;
  v_index integer;
begin
  for v_question in
    select question.value
    from pg_catalog.jsonb_array_elements(p_definition -> 'sections') as section(value)
    cross join lateral pg_catalog.jsonb_array_elements(section.value -> 'questions') as question(value)
  loop
    v_type := v_question ->> 'type';
    select count(*)::integer into v_response_count
    from public.evaluation_responses response
    where response.survey_version_id = p_version_id
      and nullif(response.answers ->> (v_question ->> 'id'), '') is not null;
    v_question_aggregate := pg_catalog.jsonb_build_object(
      'questionId', v_question ->> 'id', 'prompt', v_question ->> 'prompt',
      'type', v_type, 'responseCount', v_response_count
    );

    if v_type in ('scale', 'rating') then
      select pg_catalog.round(pg_catalog.avg((response.answers ->> (v_question ->> 'id'))::numeric), 2)
      into v_mean
      from public.evaluation_responses response
      where response.survey_version_id = p_version_id
        and nullif(response.answers ->> (v_question ->> 'id'), '') is not null;
      v_question_aggregate := v_question_aggregate || pg_catalog.jsonb_build_object('mean', v_mean);
    end if;

    if v_type in ('scale', 'rating', 'choice', 'checkbox') then
      v_distribution := '[]'::jsonb;
      if v_type in ('scale', 'rating') then
        for v_index in
          select generate_series(1, case when v_type = 'scale' then (v_question ->> 'max')::integer - (v_question ->> 'min')::integer + 1 else (v_question ->> 'max')::integer end)
        loop
          v_number := case when v_type = 'scale' then v_index + (v_question ->> 'min')::integer - 1 else v_index end;
          v_value := v_number::text;
          if v_type = 'scale' then
            v_label := case when v_number = (v_question ->> 'min')::integer then v_question ->> 'startLabel'
              when v_number = (v_question ->> 'max')::integer then v_question ->> 'endLabel' else v_value end;
          else
          v_label := coalesce(v_question -> 'descriptors' ->> (v_number - 1), v_value);
          end if;
          select count(*)::integer into v_count
          from public.evaluation_responses response
          where response.survey_version_id = p_version_id
            and response.answers ->> (v_question ->> 'id') = v_value;
          v_distribution := v_distribution || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'value', v_value, 'label', v_label, 'count', v_count,
            'percent', case when v_response_count = 0 then 0 else pg_catalog.round(v_count * 100.0 / v_response_count)::integer end
          ));
        end loop;
      else
        for v_option in select option.value from pg_catalog.jsonb_array_elements(v_question -> 'options') as option(value)
        loop
          v_value := v_option ->> 'value';
          v_label := v_option ->> 'label';
          if v_type = 'checkbox' then
            select count(*)::integer into v_count
            from public.evaluation_responses response
            where response.survey_version_id = p_version_id
              and (response.answers ->> (v_question ->> 'id'))::jsonb ? v_value;
          else
            select count(*)::integer into v_count
            from public.evaluation_responses response
            where response.survey_version_id = p_version_id
              and response.answers ->> (v_question ->> 'id') = v_value;
          end if;
          v_distribution := v_distribution || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'value', v_value, 'label', v_label, 'count', v_count,
            'percent', case when v_response_count = 0 then 0 else pg_catalog.round(v_count * 100.0 / v_response_count)::integer end
          ));
        end loop;
      end if;
      v_question_aggregate := v_question_aggregate || pg_catalog.jsonb_build_object('distribution', v_distribution);
    elsif v_type = 'paragraph' then
      select coalesce(pg_catalog.jsonb_agg(comments.answer order by comments.submitted_at desc), '[]'::jsonb)
      into v_comments
      from (
        select response.answers ->> (v_question ->> 'id') as answer, response.submitted_at
        from public.evaluation_responses response
        where response.survey_version_id = p_version_id
          and nullif(response.answers ->> (v_question ->> 'id'), '') is not null
        order by response.submitted_at desc limit 3
      ) as comments;
      v_question_aggregate := v_question_aggregate || pg_catalog.jsonb_build_object('comments', v_comments);
    end if;
    v_questions := v_questions || pg_catalog.jsonb_build_array(v_question_aggregate);
  end loop;
  return v_questions;
end;
$$;
revoke all on function private.evaluation_question_aggregates(uuid, jsonb) from public, anon, authenticated;

create function public.get_org_seminar_evaluation(p_seminar_id uuid, p_cursor jsonb default null, p_page_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_latest jsonb;
  v_versions jsonb;
  v_aggregates jsonb;
  v_responses jsonb;
  v_next_cursor jsonb;
  v_rows integer;
begin
  if v_uid is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  if not exists (
    select 1 from public.seminars seminar
    join public.organization_memberships membership on membership.organization_id = seminar.organization_id
    where seminar.id = p_seminar_id and membership.user_id = v_uid and membership.status = 'active'
  ) then raise exception using errcode = 'P0001', message = 'not_found'; end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;
  if p_cursor is not null then
    if pg_catalog.jsonb_typeof(p_cursor) <> 'object'
      or pg_catalog.jsonb_typeof(p_cursor -> 'submittedAt') <> 'string'
      or pg_catalog.jsonb_typeof(p_cursor -> 'id') <> 'string' then
      raise exception using errcode = 'P0001', message = 'validation_failed';
    end if;
    begin
      v_cursor_at := (p_cursor ->> 'submittedAt')::timestamptz;
      v_cursor_id := (p_cursor ->> 'id')::uuid;
    exception when others then
      raise exception using errcode = 'P0001', message = 'validation_failed';
    end;
  end if;

  select version_row.definition into v_latest
  from public.seminar_survey_versions version_row
  where version_row.seminar_id = p_seminar_id order by version_row.version desc limit 1;
  select coalesce(pg_catalog.jsonb_agg(version_row.definition order by version_row.version), '[]'::jsonb)
  into v_versions from public.seminar_survey_versions version_row where version_row.seminar_id = p_seminar_id;

  select coalesce(pg_catalog.jsonb_agg(aggregate_row.value order by (aggregate_row.value ->> 'surveyVersion')::integer), '[]'::jsonb)
  into v_aggregates
  from (
    select pg_catalog.jsonb_build_object(
      'seminarId', p_seminar_id,
      'surveyId', version_row.source_survey_id,
      'surveyVersion', version_row.version,
      'responseCount', count(response.id),
      'eligibleCount', (select count(*) from public.registrations registration where registration.seminar_id = p_seminar_id and private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp())),
      'completionRate', case when (select count(*) from public.registrations registration where registration.seminar_id = p_seminar_id and private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp())) = 0 then 0 else pg_catalog.round(count(response.id) * 100.0 / (select count(*) from public.registrations registration where registration.seminar_id = p_seminar_id and private.is_evaluation_eligible(registration.id, pg_catalog.clock_timestamp())))::integer end,
      'questions', private.evaluation_question_aggregates(version_row.id, version_row.definition)
    ) as value
    from public.seminar_survey_versions version_row
    left join public.evaluation_responses response on response.survey_version_id = version_row.id
    where version_row.seminar_id = p_seminar_id
    group by version_row.id
  ) aggregate_row;

  with ordered as (
    select response.id, response.submitted_at, response.answers, version_row.source_survey_id,
      version_row.version, pg_catalog.row_number() over (order by response.submitted_at, response.id) as position
    from public.evaluation_responses response
    join public.seminar_survey_versions version_row on version_row.id = response.survey_version_id
    where response.seminar_id = p_seminar_id
  ), page as (
    select ordered.* from ordered
    where v_cursor_at is null or (ordered.submitted_at, ordered.id) > (v_cursor_at, v_cursor_id)
    order by ordered.submitted_at, ordered.id
    limit p_page_size + 1
  )
  select count(*)::integer into v_rows from page;

  with ordered as (
    select response.id, response.submitted_at, response.answers, version_row.source_survey_id,
      version_row.version, pg_catalog.row_number() over (order by response.submitted_at, response.id) as position
    from public.evaluation_responses response
    join public.seminar_survey_versions version_row on version_row.id = response.survey_version_id
    where response.seminar_id = p_seminar_id
  ), page as (
    select ordered.* from ordered
    where v_cursor_at is null or (ordered.submitted_at, ordered.id) > (v_cursor_at, v_cursor_id)
    order by ordered.submitted_at, ordered.id
    limit p_page_size
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', page.id,
    'seminarId', p_seminar_id,
    'surveyId', page.source_survey_id,
    'surveyVersion', page.version,
    'respondentLabel', 'Attendee #' || pg_catalog.lpad(page.position::text, 2, '0'),
    'submittedAt', page.submitted_at,
    'answers', page.answers
  ) order by page.submitted_at, page.id), '[]'::jsonb)
  into v_responses from page;

  if v_rows > p_page_size then
    select pg_catalog.jsonb_build_object('submittedAt', last_row.submitted_at, 'id', last_row.id)
    into v_next_cursor
    from (
      select response.id, response.submitted_at
      from public.evaluation_responses response
      where response.seminar_id = p_seminar_id
        and (v_cursor_at is null or (response.submitted_at, response.id) > (v_cursor_at, v_cursor_id))
      order by response.submitted_at, response.id
      limit 1 offset p_page_size - 1
    ) last_row;
  end if;

  return pg_catalog.jsonb_build_object(
    'survey', v_latest,
    'surveyVersions', v_versions,
    'aggregates', v_aggregates,
    'responses', pg_catalog.jsonb_build_object('items', v_responses, 'nextCursor', v_next_cursor)
  );
end;
$$;
revoke all on function public.get_org_seminar_evaluation(uuid, jsonb, integer) from public, anon;
grant execute on function public.get_org_seminar_evaluation(uuid, jsonb, integer) to authenticated;

grant select (evaluation_submitted_at) on public.registrations to authenticated;
notify pgrst, 'reload schema';
