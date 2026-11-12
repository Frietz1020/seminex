-- Keep adviser access read-only for seminar authoring, attendance, and webinar proof review.
-- Organization membership approvals remain a separate adviser capability.

drop policy "Active organization members create their seminar drafts" on public.seminar_drafts;
create policy "Organization officers create their seminar drafts"
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
        and membership.role = 'org_member'
    )
  );

drop policy "Active organization members update their seminar drafts" on public.seminar_drafts;
create policy "Organization officers update their seminar drafts"
  on public.seminar_drafts for update to authenticated
  using (
    published_seminar_id is null
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
  )
  with check (
    published_seminar_id is null
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
  );

drop policy "Active organization members delete their seminar drafts" on public.seminar_drafts;
create policy "Organization officers delete their seminar drafts"
  on public.seminar_drafts for delete to authenticated
  using (
    published_seminar_id is null
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = seminar_drafts.organization_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
  );

alter function public.publish_seminar(uuid) set schema private;
alter function private.publish_seminar(uuid) rename to publish_seminar_unchecked;
revoke all on function private.publish_seminar_unchecked(uuid) from public, anon, authenticated;

create function public.publish_seminar(p_draft_id uuid)
returns public.seminars
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

  select draft.organization_id into v_organization_id
  from public.seminar_drafts as draft
  where draft.id = p_draft_id and draft.published_seminar_id is null;
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
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  return private.publish_seminar_unchecked(p_draft_id);
end;
$$;

revoke all on function public.publish_seminar(uuid) from public, anon, authenticated;
grant execute on function public.publish_seminar(uuid) to authenticated;

alter function public.create_org_edit_draft(uuid) set schema private;
alter function private.create_org_edit_draft(uuid) rename to create_org_edit_draft_unchecked;
revoke all on function private.create_org_edit_draft_unchecked(uuid) from public, anon, authenticated;

create function public.create_org_edit_draft(p_seminar_id uuid)
returns public.seminar_drafts
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

  select seminar.organization_id into v_organization_id
  from public.seminars as seminar
  where seminar.id = p_seminar_id and seminar.publication_status = 'published';
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
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  return private.create_org_edit_draft_unchecked(p_seminar_id);
end;
$$;

revoke all on function public.create_org_edit_draft(uuid) from public, anon, authenticated;
grant execute on function public.create_org_edit_draft(uuid) to authenticated;

alter function public.record_org_scan(uuid, text, text, text, uuid) set schema private;
alter function private.record_org_scan(uuid, text, text, text, uuid) rename to record_org_scan_unchecked;
revoke all on function private.record_org_scan_unchecked(uuid, text, text, text, uuid) from public, anon, authenticated;

create function public.record_org_scan(
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
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
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

  return private.record_org_scan_unchecked(p_seminar_id, p_student_id, p_method, p_reason, p_idempotency_key);
end;
$$;

revoke all on function public.record_org_scan(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_org_scan(uuid, text, text, text, uuid) to authenticated;

alter function public.review_webinar_proof(uuid, boolean, text) set schema private;
alter function private.review_webinar_proof(uuid, boolean, text) rename to review_webinar_proof_unchecked;
revoke all on function private.review_webinar_proof_unchecked(uuid, boolean, text) from public, anon, authenticated;

create function public.review_webinar_proof(p_proof_id uuid, p_approve boolean, p_reason text default null)
returns public.webinar_proofs
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

  select seminar.organization_id into v_organization_id
  from public.webinar_proofs as proof
  join public.seminars as seminar on seminar.id = proof.seminar_id
  where proof.id = p_proof_id and seminar.publication_status = 'published';
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

  return private.review_webinar_proof_unchecked(p_proof_id, p_approve, p_reason);
end;
$$;

revoke all on function public.review_webinar_proof(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.review_webinar_proof(uuid, boolean, text) to authenticated;
