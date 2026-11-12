create type public.organization_role as enum ('org_member', 'adviser');
create type public.organization_membership_status as enum ('active', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  student_id text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null,
  status public.organization_membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, student_id)
  values (
    new.id,
    new.email,
    case
      when lower(split_part(new.email, '@', 2)) = 'gordoncollege.edu.ph'
        and split_part(new.email, '@', 1) ~ '^20[0-9]{7}$'
        then split_part(new.email, '@', 1)
      else null
    end
  )
  on conflict (id) do update
  set email = excluded.email,
      student_id = excluded.student_id;

  return new;
end;
$$;

revoke all on function private.sync_auth_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_or_email_changed
  after insert or update of email on auth.users
  for each row execute function private.sync_auth_user_profile();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

revoke all on public.profiles, public.organizations, public.organization_memberships from anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_memberships to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own display name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own memberships"
  on public.organization_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members can read their own organizations"
  on public.organizations for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = organizations.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );
