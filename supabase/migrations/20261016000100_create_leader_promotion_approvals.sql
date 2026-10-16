begin;

create table if not exists public.leader_promotion_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete restrict,
  agent_auth_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending',
  direct_downline_count integer not null,
  total_downline_count integer not null,
  decided_at timestamptz null,
  decided_by uuid null references auth.users(id) on delete set null,
  decision_note text null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint leader_promotion_requests_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint leader_promotion_requests_counts_check check (
    direct_downline_count >= 1 and total_downline_count >= direct_downline_count
  ),
  constraint leader_promotion_requests_decision_check check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status in ('approved', 'rejected') and decided_at is not null and decided_by is not null)
  )
);

create unique index if not exists leader_promotion_requests_one_pending_idx
  on public.leader_promotion_requests(member_id)
  where status = 'pending';
create index if not exists leader_promotion_requests_status_created_idx
  on public.leader_promotion_requests(status, created_at desc);

create table if not exists public.leader_promotion_audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  request_id uuid not null references public.leader_promotion_requests(id) on delete restrict,
  member_id uuid not null references public.users(id) on delete restrict,
  actor_auth_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint leader_promotion_audit_logs_action_check
    check (action in ('request_created', 'approved', 'rejected'))
);

create index if not exists leader_promotion_audit_logs_request_idx
  on public.leader_promotion_audit_logs(request_id, created_at);

alter table public.leader_promotion_requests enable row level security;
alter table public.leader_promotion_audit_logs enable row level security;

drop policy if exists "Super Admin can read leader promotion requests" on public.leader_promotion_requests;
create policy "Super Admin can read leader promotion requests"
on public.leader_promotion_requests for select to authenticated
using (exists (
  select 1 from public.user_profiles as profile
  where profile.auth_user_id = auth.uid()
    and profile.status = 'active'
    and profile.role = 'super_admin'
));

drop policy if exists "Super Admin can read leader promotion audit" on public.leader_promotion_audit_logs;
create policy "Super Admin can read leader promotion audit"
on public.leader_promotion_audit_logs for select to authenticated
using (exists (
  select 1 from public.user_profiles as profile
  where profile.auth_user_id = auth.uid()
    and profile.status = 'active'
    and profile.role = 'super_admin'
));

create or replace function public.ensure_leader_promotion_request(p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.user_profiles%rowtype;
  v_direct_count integer;
  v_total_count integer;
  v_last_rejected_count integer;
  v_request_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('leader_promotion:' || p_member_id::text));

  select profile.* into v_profile
  from public.user_profiles as profile
  join public.users as member on member.id = profile.member_id
  where profile.member_id = p_member_id
    and profile.role = 'agent'
    and profile.status = 'active'
    and member.status = 'Active'
    and member.is_deleted = false;
  if not found then return null; end if;

  select pg_catalog.count(*)::integer into v_direct_count
  from public.users as member
  where member.leader_id = p_member_id
    and member.status = 'Active'
    and member.is_deleted = false;
  if v_direct_count = 0 then return null; end if;

  select request.id into v_request_id
  from public.leader_promotion_requests as request
  where request.member_id = p_member_id and request.status = 'pending';
  if found then return v_request_id; end if;

  select request.direct_downline_count into v_last_rejected_count
  from public.leader_promotion_requests as request
  where request.member_id = p_member_id and request.status = 'rejected'
  order by request.created_at desc limit 1;
  if v_last_rejected_count is not null and v_direct_count <= v_last_rejected_count then return null; end if;

  with recursive descendants(id, path) as (
    select child.id, array[p_member_id, child.id]::uuid[]
    from public.users as child
    where child.leader_id = p_member_id and child.status = 'Active' and child.is_deleted = false
    union all
    select child.id, descendants.path || child.id
    from public.users as child
    join descendants on child.leader_id = descendants.id
    where child.status = 'Active' and child.is_deleted = false
      and child.id <> all(descendants.path)
  )
  select pg_catalog.count(*)::integer into v_total_count from descendants;

  insert into public.leader_promotion_requests (
    member_id, agent_auth_user_id, direct_downline_count, total_downline_count
  ) values (p_member_id, v_profile.auth_user_id, v_direct_count, v_total_count)
  returning id into v_request_id;

  insert into public.leader_promotion_audit_logs (request_id, member_id, action, details)
  values (v_request_id, p_member_id, 'request_created', pg_catalog.jsonb_build_object(
    'role', v_profile.role,
    'direct_downline_count', v_direct_count,
    'total_downline_count', v_total_count
  ));

  return v_request_id;
end;
$$;

create or replace function public.trigger_leader_promotion_request_from_member()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.leader_id is not null and new.status = 'Active' and new.is_deleted = false then
    perform public.ensure_leader_promotion_request(new.leader_id);
  end if;
  return new;
end;
$$;

drop trigger if exists create_leader_promotion_request_from_member on public.users;
create trigger create_leader_promotion_request_from_member
after insert or update of leader_id, status, is_deleted on public.users
for each row execute function public.trigger_leader_promotion_request_from_member();

create or replace function public.trigger_leader_promotion_request_from_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.member_id is not null and new.role = 'agent' and new.status = 'active' then
    perform public.ensure_leader_promotion_request(new.member_id);
  end if;
  return new;
end;
$$;

drop trigger if exists create_leader_promotion_request_from_profile on public.user_profiles;
create trigger create_leader_promotion_request_from_profile
after insert or update of member_id, role, status on public.user_profiles
for each row execute function public.trigger_leader_promotion_request_from_profile();

create or replace function public.decide_leader_promotion_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns table (request_id uuid, request_status text, member_role text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.user_profiles%rowtype;
  v_request public.leader_promotion_requests%rowtype;
  v_target public.user_profiles%rowtype;
  v_direct_count integer;
  v_total_count integer;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_actor from public.user_profiles
  where auth_user_id = v_actor_id for update;
  if not found or v_actor.status <> 'active' or v_actor.role <> 'super_admin' then
    raise exception 'Super Admin access is required' using errcode = '42501';
  end if;

  select * into v_request from public.leader_promotion_requests
  where id = p_request_id for update;
  if not found then raise exception 'Leader Promotion Request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Leader Promotion Request is no longer pending' using errcode = '40001';
  end if;
  if v_request.agent_auth_user_id = v_actor_id then
    raise exception 'Self-approval is not allowed' using errcode = '42501';
  end if;

  select * into v_target from public.user_profiles
  where auth_user_id = v_request.agent_auth_user_id and member_id = v_request.member_id
  for update;
  if not found or v_target.status <> 'active' or v_target.role <> 'agent' then
    raise exception 'The target must still be an active Agent' using errcode = '22023';
  end if;

  select pg_catalog.count(*)::integer into v_direct_count from public.users
  where leader_id = v_request.member_id and status = 'Active' and is_deleted = false;
  if v_direct_count = 0 then
    raise exception 'The Agent no longer has an active direct downline' using errcode = '22023';
  end if;

  with recursive descendants(id, path) as (
    select child.id, array[v_request.member_id, child.id]::uuid[] from public.users child
    where child.leader_id = v_request.member_id and child.status = 'Active' and child.is_deleted = false
    union all
    select child.id, descendants.path || child.id from public.users child
    join descendants on child.leader_id = descendants.id
    where child.status = 'Active' and child.is_deleted = false and child.id <> all(descendants.path)
  ) select pg_catalog.count(*)::integer into v_total_count from descendants;

  if p_decision = 'approved' then
    update public.user_profiles set role = 'leader' where auth_user_id = v_request.agent_auth_user_id;
  end if;

  update public.leader_promotion_requests set
    status = p_decision,
    direct_downline_count = v_direct_count,
    total_downline_count = v_total_count,
    decided_at = pg_catalog.now(),
    decided_by = v_actor_id,
    decision_note = nullif(pg_catalog.btrim(p_note), ''),
    updated_at = pg_catalog.now()
  where id = p_request_id;

  insert into public.leader_promotion_audit_logs (
    request_id, member_id, actor_auth_user_id, action, details
  ) values (
    p_request_id, v_request.member_id, v_actor_id,
    case when p_decision = 'approved' then 'approved' else 'rejected' end,
    pg_catalog.jsonb_build_object(
      'previous_role', v_target.role,
      'next_role', case when p_decision = 'approved' then 'leader' else v_target.role end,
      'direct_downline_count', v_direct_count,
      'total_downline_count', v_total_count,
      'note', nullif(pg_catalog.btrim(p_note), '')
    )
  );

  return query select p_request_id, p_decision,
    case when p_decision = 'approved' then 'leader'::text else v_target.role end;
end;
$$;

create or replace function public.backfill_leader_promotion_requests()
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_profile record;
  v_before integer;
  v_after integer;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  select pg_catalog.count(*)::integer into v_before from public.leader_promotion_requests;
  for v_profile in select member_id from public.user_profiles
    where role = 'agent' and status = 'active' and member_id is not null
  loop
    perform public.ensure_leader_promotion_request(v_profile.member_id);
  end loop;
  select pg_catalog.count(*)::integer into v_after from public.leader_promotion_requests;
  return v_after - v_before;
end;
$$;

-- Prevent the legacy user-management RPC from being used for direct Agent -> Leader escalation.
create or replace function public.manage_falconhub_user_with_display_name(
  p_target_auth_user_id uuid,
  p_role text default null,
  p_update_member_profile boolean default false,
  p_display_name text default null,
  p_position text default null,
  p_employment_type text default null,
  p_leader_id uuid default null,
  p_join_date date default null,
  p_member_status text default null
)
returns table (success boolean)
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_display_name text;
  v_member_id uuid;
  v_current_role text;
begin
  select role into v_current_role from public.user_profiles
  where auth_user_id = p_target_auth_user_id;
  if nullif(pg_catalog.btrim(p_role), '') = 'leader' and v_current_role is distinct from 'leader' then
    raise exception 'Agent promotion requires an approved Leader Promotion Request' using errcode = '42501';
  end if;

  if p_update_member_profile then
    v_display_name := nullif(pg_catalog.btrim(p_display_name), '');
    if v_display_name is not null and pg_catalog.char_length(v_display_name) > 80 then
      raise exception 'Display Name must be 80 characters or fewer' using errcode = '22023';
    end if;
  end if;

  perform * from public.manage_falconhub_user(
    p_target_auth_user_id, p_role, p_update_member_profile, p_position,
    p_employment_type, p_leader_id, p_join_date, p_member_status
  );
  if p_update_member_profile then
    select member_id into v_member_id from public.user_profiles where auth_user_id = p_target_auth_user_id;
    update public.users set display_name = v_display_name where id = v_member_id;
  end if;
  return query select true;
end;
$$;

revoke all on function public.ensure_leader_promotion_request(uuid) from public, anon, authenticated;
revoke all on function public.trigger_leader_promotion_request_from_member() from public, anon, authenticated;
revoke all on function public.trigger_leader_promotion_request_from_profile() from public, anon, authenticated;
revoke all on function public.decide_leader_promotion_request(uuid, text, text) from public, anon;
grant execute on function public.decide_leader_promotion_request(uuid, text, text) to authenticated;
revoke all on function public.backfill_leader_promotion_requests() from public, anon, authenticated;
grant execute on function public.backfill_leader_promotion_requests() to service_role;
revoke all on function public.manage_falconhub_user(uuid, text, boolean, text, text, uuid, date, text) from authenticated;
revoke all on function public.manage_falconhub_user_with_display_name(uuid, text, boolean, text, text, text, uuid, date, text) from public, anon;
grant execute on function public.manage_falconhub_user_with_display_name(uuid, text, boolean, text, text, text, uuid, date, text) to authenticated;

commit;
