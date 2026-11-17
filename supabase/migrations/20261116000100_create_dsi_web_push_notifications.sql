begin;

do $$
begin
  if pg_catalog.to_regclass('public.user_profiles') is null
     or pg_catalog.to_regclass('public.users') is null
     or pg_catalog.to_regclass('public.daily_sales_index_entries') is null
     or pg_catalog.to_regclass('auth.users') is null then
    raise exception 'DSI Web Push dependencies are missing';
  end if;

  if pg_catalog.to_regclass('public.push_subscriptions') is not null
     or pg_catalog.to_regclass('public.dsi_push_reminder_deliveries') is not null
     or pg_catalog.to_regprocedure('public.set_push_subscription_updated_at()') is not null then
    raise exception 'DSI Web Push target objects already exist';
  end if;
end;
$$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  expiration_time timestamptz null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_check
    check (
      endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/'
      and char_length(endpoint) <= 4096
    ),
  constraint push_subscriptions_p256dh_check
    check (p256dh ~ '^[A-Za-z0-9_-]+$' and char_length(p256dh) between 16 and 512),
  constraint push_subscriptions_auth_key_check
    check (auth_key ~ '^[A-Za-z0-9_-]+$' and char_length(auth_key) between 8 and 256),
  constraint push_subscriptions_user_agent_check
    check (user_agent is null or char_length(user_agent) <= 512)
);

create index push_subscriptions_auth_user_id_idx
  on public.push_subscriptions(auth_user_id, updated_at desc);

create index push_subscriptions_member_id_idx
  on public.push_subscriptions(member_id, updated_at desc);

create table public.dsi_push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  activity_date date not null,
  reminder_slot text not null,
  status text not null default 'claimed',
  subscription_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  expired_count integer not null default 0,
  last_error_code text null,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint dsi_push_reminder_deliveries_user_date_slot_unique
    unique (auth_user_id, activity_date, reminder_slot),
  constraint dsi_push_reminder_deliveries_slot_check
    check (reminder_slot in ('22:00', '23:00', '23:30')),
  constraint dsi_push_reminder_deliveries_status_check
    check (status in ('claimed', 'sent', 'partial', 'failed', 'expired', 'skipped_submitted')),
  constraint dsi_push_reminder_deliveries_counts_check
    check (
      subscription_count >= 0
      and sent_count >= 0
      and failed_count >= 0
      and expired_count >= 0
      and sent_count + failed_count + expired_count <= subscription_count
    ),
  constraint dsi_push_reminder_deliveries_completion_check
    check (
      (status = 'claimed' and completed_at is null)
      or (status <> 'claimed' and completed_at is not null)
    )
);

create index dsi_push_reminder_deliveries_activity_date_idx
  on public.dsi_push_reminder_deliveries(activity_date desc, reminder_slot);

create index dsi_push_reminder_deliveries_member_id_idx
  on public.dsi_push_reminder_deliveries(member_id, activity_date desc);

create function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_push_subscription_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.dsi_push_reminder_deliveries enable row level security;

create policy "Users can read their own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from public.user_profiles as profile
    where profile.auth_user_id = auth.uid()
      and profile.member_id = push_subscriptions.member_id
      and profile.status = 'active'
  )
);

create policy "Users can create their own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from public.user_profiles as profile
    where profile.auth_user_id = auth.uid()
      and profile.member_id = push_subscriptions.member_id
      and profile.status = 'active'
  )
);

create policy "Users can update their own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from public.user_profiles as profile
    where profile.auth_user_id = auth.uid()
      and profile.member_id = push_subscriptions.member_id
      and profile.status = 'active'
  )
)
with check (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from public.user_profiles as profile
    where profile.auth_user_id = auth.uid()
      and profile.member_id = push_subscriptions.member_id
      and profile.status = 'active'
  )
);

create policy "Users can delete their own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  auth.uid() = auth_user_id
  and exists (
    select 1
    from public.user_profiles as profile
    where profile.auth_user_id = auth.uid()
      and profile.member_id = push_subscriptions.member_id
      and profile.status = 'active'
  )
);

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;

revoke all on table public.dsi_push_reminder_deliveries from public, anon, authenticated;
grant all on table public.dsi_push_reminder_deliveries to service_role;

revoke all on function public.set_push_subscription_updated_at() from public, anon, authenticated;
grant execute on function public.set_push_subscription_updated_at() to service_role;

commit;
