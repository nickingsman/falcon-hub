create table if not exists public.user_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  member_id uuid null references public.users(id) on delete set null,
  role text not null default 'agent',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_profiles_role_check
    check (role in ('super_admin', 'admin', 'leader', 'agent')),
  constraint user_profiles_status_check
    check (status in ('active', 'inactive'))
);

alter table public.user_profiles enable row level security;

create index if not exists user_profiles_member_id_idx
  on public.user_profiles(member_id)
  where member_id is not null;

create or replace function public.set_user_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_user_profiles_updated_at();

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = auth_user_id);
