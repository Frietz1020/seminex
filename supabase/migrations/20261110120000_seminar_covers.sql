insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seminar-covers', 'seminar-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Organization officers upload seminar covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'seminar-covers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
    and exists (
      select 1
      from public.seminar_drafts as draft
      where draft.id::text = (storage.foldername(name))[2]
        and draft.organization_id::text = (storage.foldername(name))[1]
        and draft.published_seminar_id is null
    )
  );

create policy "Organization officers delete seminar covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'seminar-covers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'org_member'
    )
    and exists (
      select 1
      from public.seminar_drafts as draft
      where draft.id::text = (storage.foldername(name))[2]
        and draft.organization_id::text = (storage.foldername(name))[1]
        and draft.published_seminar_id is null
    )
  );
