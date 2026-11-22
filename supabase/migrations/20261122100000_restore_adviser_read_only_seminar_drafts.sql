drop policy if exists "Organization officers update their seminar drafts" on public.seminar_drafts;

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
        and membership.role = 'org_member'
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
        and membership.role = 'org_member'
    )
  );
