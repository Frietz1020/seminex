-- Preserve existing hour-based windows while moving authoring and enforcement to minutes.
alter table public.seminars
  add column confirmation_opens_minutes_before integer not null default 1440,
  add column confirmation_closes_minutes_before integer not null default 60;

update public.seminars
set confirmation_opens_minutes_before = confirmation_opens_hours_before * 60,
    confirmation_closes_minutes_before = confirmation_closes_hours_before * 60;

alter table public.seminars
  add constraint seminars_confirmation_minutes_bounds_check
    check (confirmation_opens_minutes_before between 1 and 10080
      and confirmation_closes_minutes_before between 1 and 10080),
  add constraint seminars_confirmation_minutes_order_check
    check (confirmation_opens_minutes_before > confirmation_closes_minutes_before);

grant select (confirmation_opens_minutes_before, confirmation_closes_minutes_before)
  on public.seminars to anon, authenticated;

update public.seminar_drafts
set details = (details - 'confirmationOpensHoursBefore' - 'confirmationClosesHoursBefore')
  || case when details ->> 'confirmationOpensHoursBefore' ~ '^[0-9]+$'
    then jsonb_build_object('confirmationOpensMinutesBefore', (details ->> 'confirmationOpensHoursBefore')::integer * 60)
    else '{}'::jsonb end
  || case when details ->> 'confirmationClosesHoursBefore' ~ '^[0-9]+$'
    then jsonb_build_object('confirmationClosesMinutesBefore', (details ->> 'confirmationClosesHoursBefore')::integer * 60)
    else '{}'::jsonb end
where details ? 'confirmationOpensHoursBefore' or details ? 'confirmationClosesHoursBefore';

update public.seminar_drafts
set certificate_template = certificate_template - 'signatureBox' - 'signatureBoxes'
where certificate_template ? 'signatureBox' or certificate_template ? 'signatureBoxes';

alter table public.seminar_drafts
  add column deletion_requested_at timestamptz;

drop policy "Organization officers update their seminar drafts" on public.seminar_drafts;
create policy "Organization officers update their seminar drafts"
  on public.seminar_drafts for update to authenticated
  using (
    published_seminar_id is null
    and deletion_requested_at is null
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  )
  with check (
    published_seminar_id is null
    and deletion_requested_at is null
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

drop policy "Organization officers delete their seminar drafts" on public.seminar_drafts;
create policy "Organization officers delete their seminar drafts"
  on public.seminar_drafts for delete to authenticated
  using (
    published_seminar_id is null
    and deletion_requested_at is not null
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

create function private.prevent_publish_during_draft_deletion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deletion_requested_at is not null
    and new.published_seminar_id is distinct from old.published_seminar_id then
    raise exception using errcode = 'P0001', message = 'draft_deletion_in_progress';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_publish_during_draft_deletion() from public, anon, authenticated;

create trigger seminar_drafts_prevent_publish_during_deletion
  before update of published_seminar_id on public.seminar_drafts
  for each row execute function private.prevent_publish_during_draft_deletion();

create function public.begin_org_draft_deletion(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  update public.seminar_drafts as draft
  set deletion_requested_at = coalesce(draft.deletion_requested_at, pg_catalog.clock_timestamp())
  where draft.id = p_draft_id
    and draft.published_seminar_id is null
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = draft.organization_id
        and membership.user_id = v_uid
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
  returning draft.organization_id into v_organization_id;

  if v_organization_id is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return v_organization_id;
end;
$$;
revoke all on function public.begin_org_draft_deletion(uuid) from public, anon, authenticated;
grant execute on function public.begin_org_draft_deletion(uuid) to authenticated;

-- Keep every existing security definer function body and ACL, changing only its persisted
-- confirmation-window columns, JSON keys, and interval unit.
do $$
declare
  item record;
  definition text;
begin
  for item in
    select procedure.oid
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosrc like '%confirmation_%_hours_before%'
  loop
    definition := pg_catalog.pg_get_functiondef(item.oid);
    definition := replace(definition, 'confirmation_opens_hours_before', 'confirmation_opens_minutes_before');
    definition := replace(definition, 'confirmation_closes_hours_before', 'confirmation_closes_minutes_before');
    definition := replace(definition, 'confirmationOpensHoursBefore', 'confirmationOpensMinutesBefore');
    definition := replace(definition, 'confirmationClosesHoursBefore', 'confirmationClosesMinutesBefore');
    definition := replace(definition, 'make_interval(hours =>', 'make_interval(mins =>');
    definition := replace(definition,
      $pattern$confirmationOpensMinutesBefore', '')::integer, 24$pattern$,
      $pattern$confirmationOpensMinutesBefore', '')::integer, 1440$pattern$);
    definition := replace(definition,
      $pattern$confirmationClosesMinutesBefore', '')::integer, 1$pattern$,
      $pattern$confirmationClosesMinutesBefore', '')::integer, 60$pattern$);
    definition := replace(definition, 'v_confirmation_opens <= v_confirmation_closes',
      'v_confirmation_opens <= v_confirmation_closes or v_confirmation_opens < 1 or v_confirmation_closes < 1 or v_confirmation_opens > 10080 or v_confirmation_closes > 10080');
    execute definition;
  end loop;
end;
$$;

do $$
declare
  definition text := pg_catalog.pg_get_functiondef('private.valid_survey_definition(jsonb)'::regprocedure);
begin
  definition := replace(definition,
    'or (v_question ->> ''min'')::integer >= (v_question ->> ''max'')::integer) then',
    'or (v_question ->> ''min'')::integer < 0
        or (v_question ->> ''max'')::integer > 10
        or (v_question ->> ''min'')::integer >= (v_question ->> ''max'')::integer) then');
  execute definition;
end;
$$;

-- The registration view is not a function, so update its window calculation separately.
do $$
declare
  definition text;
begin
  definition := pg_catalog.pg_get_viewdef('public.registration_read_model'::regclass, true);
  definition := replace(definition, 'confirmation_closes_hours_before', 'confirmation_closes_minutes_before');
  definition := replace(definition, 'make_interval(hours =>', 'make_interval(mins =>');
  execute 'create or replace view public.registration_read_model with (security_invoker = true) as ' || definition;
end;
$$;

create policy "Organization officers list their draft seminar covers"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'seminar-covers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
    and exists (
      select 1 from public.seminar_drafts as draft
      where draft.id::text = (storage.foldername(name))[2]
        and draft.organization_id::text = (storage.foldername(name))[1]
        and draft.published_seminar_id is null
    )
  );

create function public.archive_org_seminar(p_seminar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  update public.seminars as seminar
  set publication_status = 'archived', updated_at = pg_catalog.clock_timestamp()
  where seminar.id = p_seminar_id
    and seminar.publication_status = 'published'
    and exists (
      select 1 from public.organization_memberships as membership
      where membership.organization_id = seminar.organization_id
        and membership.user_id = v_uid
        and membership.status = 'active'
        and membership.role = 'org_member'
    );

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
end;
$$;

revoke all on function public.archive_org_seminar(uuid) from public, anon, authenticated;
grant execute on function public.archive_org_seminar(uuid) to authenticated;
