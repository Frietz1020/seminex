alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column middle_initial text not null default '',
  add column program text,
  add column year_level smallint,
  add column block text;

alter table public.profiles
  add constraint profiles_email_domain_check check (email ~* '^[^@]+@gordoncollege\.edu\.ph$'),
  add constraint profiles_student_id_format_check check (student_id is null or student_id ~ '^20[0-9]{7}$');

alter table public.profiles
  add constraint profiles_program_check check (program is null or program in ('CS', 'IT', 'EMC')),
  add constraint profiles_year_level_check check (year_level is null or year_level between 1 and 4),
  add constraint profiles_block_check check (block is null or block in ('A', 'B', 'C', 'D', 'E', 'F'));

alter table public.organizations
  add column department text not null default 'CCS';

drop policy "Members can read their own organizations" on public.organizations;
grant select on public.organizations to anon;

create policy "Organization catalog is publicly readable"
  on public.organizations for select to anon, authenticated
  using (true);

create type public.organization_request_status as enum ('pending', 'approved', 'rejected');

create table public.organization_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position text not null check (length(trim(position)) between 1 and 120),
  statement text check (statement is null or length(statement) <= 300),
  status public.organization_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text
);

create index organization_access_requests_user_requested_idx
  on public.organization_access_requests (user_id, requested_at desc);
create index organization_access_requests_org_status_idx
  on public.organization_access_requests (organization_id, status);
create unique index organization_access_requests_one_pending_per_org_idx
  on public.organization_access_requests (user_id, organization_id)
  where status = 'pending';

alter table public.organization_access_requests enable row level security;
revoke all on public.organization_access_requests from anon, authenticated;
grant select on public.organization_access_requests to authenticated;
grant insert (organization_id, user_id, position, statement) on public.organization_access_requests to authenticated;
grant delete on public.organization_access_requests to authenticated;

create policy "Users can read their own organization requests"
  on public.organization_access_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Advisers can read requests for their organizations"
  on public.organization_access_requests for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = organization_access_requests.organization_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'adviser'
        and membership.status = 'active'
    )
  );

create policy "Users can create their own pending organization request"
  on public.organization_access_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and nullif(trim(profile.first_name), '') is not null
        and nullif(trim(profile.last_name), '') is not null
        and profile.program is not null
        and profile.year_level is not null
        and profile.block is not null
    )
  );

create policy "Users can withdraw their own pending organization request"
  on public.organization_access_requests for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'pending');

grant update (display_name, first_name, last_name, middle_initial, program, year_level, block)
  on public.profiles to authenticated;

create function public.complete_org_signup(
  p_first_name text,
  p_last_name text,
  p_middle_initial text,
  p_program text,
  p_year_level smallint,
  p_block text,
  p_organization_id uuid,
  p_position text,
  p_statement text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  update public.profiles
  set first_name = p_first_name,
      last_name = p_last_name,
      middle_initial = p_middle_initial,
      program = p_program,
      year_level = p_year_level,
      block = p_block,
      display_name = trim(p_first_name || ' ' || p_last_name)
  where id = auth.uid();

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  insert into public.organization_access_requests (organization_id, user_id, position, statement)
  values (p_organization_id, auth.uid(), p_position, p_statement)
  returning id into created_request_id;

  return created_request_id;
end;
$$;

revoke all on function public.complete_org_signup(text, text, text, text, smallint, text, uuid, text, text)
  from public, anon;
grant execute on function public.complete_org_signup(text, text, text, text, smallint, text, uuid, text, text)
  to authenticated;
