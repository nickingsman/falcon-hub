alter table public.user_profiles
  drop constraint if exists user_profiles_status_check;

alter table public.user_profiles
  add constraint user_profiles_status_check
  check (status in (
    'pending_approval',
    'pending_profile',
    'active',
    'inactive',
    'rejected'
  ));

alter table public.user_profiles
  add column if not exists approved_position text null,
  add column if not exists approved_employment_type text null,
  add column if not exists approved_leader_id uuid null references public.users(id) on delete set null,
  add column if not exists approved_join_date date null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by uuid null references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists rejected_by uuid null references auth.users(id) on delete set null;

create index if not exists user_profiles_status_idx
  on public.user_profiles(status);

create index if not exists user_profiles_approved_leader_id_idx
  on public.user_profiles(approved_leader_id)
  where approved_leader_id is not null;

create index if not exists user_profiles_approved_by_idx
  on public.user_profiles(approved_by)
  where approved_by is not null;

create index if not exists user_profiles_rejected_by_idx
  on public.user_profiles(rejected_by)
  where rejected_by is not null;

create table if not exists public.user_private_details (
  user_id uuid primary key references public.users(id) on delete cascade,
  nric_number text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_private_details enable row level security;

create or replace function public.set_user_private_details_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_private_details_updated_at on public.user_private_details;
create trigger set_user_private_details_updated_at
before update on public.user_private_details
for each row execute function public.set_user_private_details_updated_at();

drop policy if exists "Users can read their own private details" on public.user_private_details;
create policy "Users can read their own private details"
on public.user_private_details
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles
    where user_profiles.auth_user_id = auth.uid()
      and user_profiles.member_id = user_private_details.user_id
  )
);

drop policy if exists "Users can update their own private details" on public.user_private_details;
create policy "Users can update their own private details"
on public.user_private_details
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles
    where user_profiles.auth_user_id = auth.uid()
      and user_profiles.member_id = user_private_details.user_id
  )
)
with check (
  exists (
    select 1
    from public.user_profiles
    where user_profiles.auth_user_id = auth.uid()
      and user_profiles.member_id = user_private_details.user_id
  )
);
