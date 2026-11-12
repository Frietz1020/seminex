-- Organization evaluation response paging uses opaque UUID order and omits submission timing.
-- Business rule: response UUID ordering is an arbitrary display order, not a response-time order.
create or replace function public.get_org_seminar_evaluation(p_seminar_id uuid, p_cursor jsonb default null, p_page_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
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
      or pg_catalog.jsonb_typeof(p_cursor -> 'id') <> 'string' then
      raise exception using errcode = 'P0001', message = 'validation_failed';
    end if;
    begin
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
    select response.id, response.answers, version_row.source_survey_id, version_row.version
    from public.evaluation_responses response
    join public.seminar_survey_versions version_row on version_row.id = response.survey_version_id
    where response.seminar_id = p_seminar_id
  ), page as (
    select ordered.* from ordered
    where v_cursor_id is null or ordered.id > v_cursor_id
    order by ordered.id
    limit p_page_size + 1
  )
  select count(*)::integer into v_rows from page;

  with ordered as (
    select response.id, response.answers, version_row.source_survey_id, version_row.version
    from public.evaluation_responses response
    join public.seminar_survey_versions version_row on version_row.id = response.survey_version_id
    where response.seminar_id = p_seminar_id
  ), page as (
    select ordered.* from ordered
    where v_cursor_id is null or ordered.id > v_cursor_id
    order by ordered.id
    limit p_page_size
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', page.id,
    'seminarId', p_seminar_id,
    'surveyId', page.source_survey_id,
    'surveyVersion', page.version,
    'answers', page.answers
  ) order by page.id), '[]'::jsonb)
  into v_responses from page;

  if v_rows > p_page_size then
    select pg_catalog.jsonb_build_object('id', last_row.id)
    into v_next_cursor
    from (
      select response.id
      from public.evaluation_responses response
      where response.seminar_id = p_seminar_id
        and (v_cursor_id is null or response.id > v_cursor_id)
      order by response.id
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
notify pgrst, 'reload schema';
