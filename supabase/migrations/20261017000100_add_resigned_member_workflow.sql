begin;

do $$
declare
  v_constraint_name text;
  v_definition text;
  v_values text[];
begin
  select constraint_row.conname, pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint_name, v_definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as table_row on table_row.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and table_row.relname = 'users'
    and constraint_row.contype = 'c'
    and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)) like '%status%';

  if v_constraint_name is null then
    raise exception 'Expected public.users status CHECK constraint was not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint as duplicate_check
    join pg_catalog.pg_class as table_row on table_row.oid = duplicate_check.conrelid
    join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'users'
      and duplicate_check.contype = 'c'
      and pg_catalog.lower(pg_catalog.pg_get_constraintdef(duplicate_check.oid, true)) like '%status%'
      and duplicate_check.conname <> v_constraint_name
  ) then
    raise exception 'Multiple public.users status CHECK constraints were found' using errcode = 'P0001';
  end if;

  select pg_catalog.array_agg(value order by value)
  into v_values
  from (
    select distinct captures[1] as value
    from pg_catalog.regexp_matches(v_definition, '''([^'']+)''', 'g')
      as extracted_match(captures)
  ) as extracted;

  if v_values is null then
    raise exception 'Could not extract values from public.users status CHECK definition: %', v_definition
      using errcode = 'P0001';
  end if;

  if pg_catalog.cardinality(v_values) = 5
     and v_values @> array['Active', 'Inactive', 'On Leave', 'Resigned', 'Suspended']::text[]
     and array['Active', 'Inactive', 'On Leave', 'Resigned', 'Suspended']::text[] @> v_values then
    return;
  end if;

  if pg_catalog.cardinality(v_values) <> 4
     or not v_values @> array['Active', 'Inactive', 'On Leave', 'Suspended']::text[]
     or not array['Active', 'Inactive', 'On Leave', 'Suspended']::text[] @> v_values then
    raise exception 'Unexpected public.users status CHECK definition: %', v_definition using errcode = 'P0001';
  end if;

  execute pg_catalog.format('alter table public.users drop constraint %I', v_constraint_name);
  alter table public.users
    add constraint users_status_check
    check (status in ('Active', 'Inactive', 'On Leave', 'Suspended', 'Resigned'));
end;
$$;

do $$
declare
  v_constraint_name text;
  v_definition text;
  v_values text[];
begin
  select constraint_row.conname, pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint_name, v_definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as table_row on table_row.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and table_row.relname = 'admin_user_audit_logs'
    and constraint_row.contype = 'c'
    and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)) like '%action%';

  if v_constraint_name is null then
    raise exception 'Expected admin_user_audit_logs action CHECK constraint was not found' using errcode = 'P0002';
  end if;

  select pg_catalog.array_agg(value order by value)
  into v_values
  from (
    select distinct captures[1] as value
    from pg_catalog.regexp_matches(v_definition, '''([^'']+)''', 'g')
      as extracted_match(captures)
  ) as extracted;

  if v_values is null then
    raise exception 'Could not extract values from admin_user_audit_logs action CHECK definition: %', v_definition
      using errcode = 'P0001';
  end if;

  if pg_catalog.cardinality(v_values) = 6
     and v_values @> array[
    'falcon_hub_access_deactivated',
    'falcon_hub_access_reactivated',
    'member_downline_reassigned',
    'member_profile_updated',
    'member_resigned',
    'role_changed'
  ]::text[]
     and array[
       'falcon_hub_access_deactivated',
       'falcon_hub_access_reactivated',
       'member_downline_reassigned',
       'member_profile_updated',
       'member_resigned',
       'role_changed'
     ]::text[] @> v_values then
    return;
  end if;

  if pg_catalog.cardinality(v_values) <> 4
     or not v_values @> array[
    'falcon_hub_access_deactivated',
    'falcon_hub_access_reactivated',
    'member_profile_updated',
    'role_changed'
  ]::text[]
     or not array[
       'falcon_hub_access_deactivated',
       'falcon_hub_access_reactivated',
       'member_profile_updated',
       'role_changed'
     ]::text[] @> v_values then
    raise exception 'Unexpected admin_user_audit_logs action CHECK definition: %', v_definition using errcode = 'P0001';
  end if;

  execute pg_catalog.format(
    'alter table public.admin_user_audit_logs drop constraint %I',
    v_constraint_name
  );
  alter table public.admin_user_audit_logs
    add constraint admin_user_audit_logs_action_check
    check (action in (
      'role_changed',
      'member_profile_updated',
      'falcon_hub_access_deactivated',
      'falcon_hub_access_reactivated',
      'member_downline_reassigned',
      'member_resigned'
    ));
end;
$$;

create or replace function public.guard_resigned_member_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.user_profiles%rowtype;
  v_target_profile public.user_profiles%rowtype;
  v_active_super_admin_count integer;
begin
  if old.status = 'Resigned' and new.status is distinct from 'Resigned' then
    raise exception 'Resigned members require an explicit reactivation workflow' using errcode = '42501';
  end if;

  if old.status is distinct from 'Resigned' and new.status = 'Resigned' then
    if v_actor_id is null then
      raise exception 'Use the authenticated resignation workflow to resign a member' using errcode = '42501';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('falconhub_admin_user_management')
    );

    select profile.* into v_actor
    from public.user_profiles as profile
    where profile.auth_user_id = v_actor_id
    for update;
    if not found or v_actor.status <> 'active' or v_actor.role not in ('super_admin', 'admin') then
      raise exception 'Active Admin or Super Admin access is required' using errcode = '42501';
    end if;

    select profile.* into v_target_profile
    from public.user_profiles as profile
    where profile.member_id = old.id
    for update;

    if found and v_target_profile.auth_user_id = v_actor_id then
      raise exception 'You cannot resign and deactivate your own account' using errcode = '42501';
    end if;
    if found and v_actor.role = 'admin' and v_target_profile.role = 'super_admin' then
      raise exception 'Admins cannot resign a Super Admin account' using errcode = '42501';
    end if;
    if found and v_target_profile.role = 'super_admin' and v_target_profile.status = 'active' then
      select pg_catalog.count(*)::integer into v_active_super_admin_count
      from public.user_profiles as profile
      where profile.role = 'super_admin' and profile.status = 'active';
      if v_active_super_admin_count <= 1 then
        raise exception 'The final active Super Admin cannot be resigned' using errcode = '42501';
      end if;
    end if;

    if exists (
      select 1 from public.users as child
      where child.leader_id = old.id and child.status = 'Active' and child.is_deleted = false
    ) then
      raise exception 'Reassign every active direct downline before resigning this member' using errcode = '23514';
    end if;

    insert into public.admin_user_audit_logs (
      actor_auth_user_id, target_auth_user_id, target_member_id,
      action, old_values, new_values
    ) values (
      v_actor_id, v_target_profile.auth_user_id, old.id,
      'member_resigned',
      pg_catalog.jsonb_build_object('status', old.status),
      pg_catalog.jsonb_build_object('status', 'Resigned')
    );

    if v_target_profile.auth_user_id is not null
       and v_target_profile.status in ('active', 'pending_approval', 'pending_profile') then
      update public.user_profiles as profile
      set status = 'inactive'
      where profile.auth_user_id = v_target_profile.auth_user_id
        and profile.status = v_target_profile.status;

      insert into public.admin_user_audit_logs (
        actor_auth_user_id, target_auth_user_id, target_member_id,
        action, old_values, new_values
      ) values (
        v_actor_id, v_target_profile.auth_user_id, old.id,
        'falcon_hub_access_deactivated',
        pg_catalog.jsonb_build_object('status', v_target_profile.status),
        pg_catalog.jsonb_build_object('status', 'inactive', 'reason', 'member_resigned')
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_resigned_member_status_change on public.users;
create trigger guard_resigned_member_status_change
before update of status on public.users
for each row execute function public.guard_resigned_member_status_change();

create or replace function public.resign_falconhub_member(
  p_member_id uuid,
  p_downline_reassignments jsonb default '[]'::jsonb
)
returns table (success boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.user_profiles%rowtype;
  v_target public.users%rowtype;
  v_target_profile public.user_profiles%rowtype;
  v_direct_count integer;
  v_assignment_count integer;
  v_active_super_admin_count integer;
  v_assignment record;
  v_cycle_found boolean;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('falconhub_admin_user_management')
  );

  select profile.* into v_actor
  from public.user_profiles as profile
  where profile.auth_user_id = v_actor_id
  for update;

  if not found or v_actor.status <> 'active' or v_actor.role not in ('super_admin', 'admin') then
    raise exception 'Active Admin or Super Admin access is required' using errcode = '42501';
  end if;

  select member.* into v_target
  from public.users as member
  where member.id = p_member_id and member.is_deleted = false
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.status <> 'Active' then
    raise exception 'Only an Active member can be resigned' using errcode = '23514';
  end if;

  select profile.* into v_target_profile
  from public.user_profiles as profile
  where profile.member_id = p_member_id
  for update;

  if found and v_target_profile.auth_user_id = v_actor_id then
    raise exception 'You cannot resign and deactivate your own account' using errcode = '42501';
  end if;

  if found and v_actor.role = 'admin' and v_target_profile.role = 'super_admin' then
    raise exception 'Admins cannot resign a Super Admin account' using errcode = '42501';
  end if;

  if found and v_target_profile.role = 'super_admin' and v_target_profile.status = 'active' then
    select pg_catalog.count(*)::integer into v_active_super_admin_count
    from public.user_profiles as profile
    where profile.role = 'super_admin' and profile.status = 'active';
    if v_active_super_admin_count <= 1 then
      raise exception 'The final active Super Admin cannot be resigned' using errcode = '42501';
    end if;
  end if;

  if p_downline_reassignments is null or pg_catalog.jsonb_typeof(p_downline_reassignments) <> 'array' then
    raise exception 'Downline reassignments must be a JSON array' using errcode = '22023';
  end if;

  perform 1
  from public.users as child
  where child.leader_id = p_member_id and child.status = 'Active' and child.is_deleted = false
  for update;

  select pg_catalog.count(*)::integer into v_direct_count
  from public.users as child
  where child.leader_id = p_member_id and child.status = 'Active' and child.is_deleted = false;

  select pg_catalog.count(*)::integer into v_assignment_count
  from pg_catalog.jsonb_to_recordset(p_downline_reassignments)
    as assignment(member_id uuid, leader_id uuid);

  if v_assignment_count <> v_direct_count then
    raise exception 'Every active direct downline requires an explicit reassignment' using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_downline_reassignments)
      as assignment(member_id uuid, leader_id uuid)
    group by assignment.member_id
    having assignment.member_id is null or pg_catalog.count(*) <> 1
  ) then
    raise exception 'Downline reassignment contains a missing or duplicate member' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_downline_reassignments)
      as assignment(member_id uuid, leader_id uuid)
    left join public.users as child on child.id = assignment.member_id
    where child.id is null or child.leader_id is distinct from p_member_id
      or child.status <> 'Active' or child.is_deleted = true
  ) or exists (
    select 1
    from public.users as child
    where child.leader_id = p_member_id and child.status = 'Active' and child.is_deleted = false
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_downline_reassignments)
          as assignment(member_id uuid, leader_id uuid)
        where assignment.member_id = child.id
      )
  ) then
    raise exception 'Downline assignments no longer match the active direct downlines' using errcode = '23514';
  end if;

  for v_assignment in
    select assignment.member_id, assignment.leader_id
    from pg_catalog.jsonb_to_recordset(p_downline_reassignments)
      as assignment(member_id uuid, leader_id uuid)
  loop
    if v_assignment.leader_id is not null then
      if v_assignment.leader_id in (p_member_id, v_assignment.member_id) or not exists (
        select 1 from public.users as leader
        where leader.id = v_assignment.leader_id
          and leader.status = 'Active' and leader.is_deleted = false
      ) then
        raise exception 'Replacement leader must be an eligible Active member' using errcode = '23503';
      end if;
    end if;

    update public.users as child
    set leader_id = v_assignment.leader_id
    where child.id = v_assignment.member_id;

    insert into public.admin_user_audit_logs (
      actor_auth_user_id, target_auth_user_id, target_member_id,
      action, old_values, new_values
    ) values (
      v_actor_id, null, v_assignment.member_id,
      'member_downline_reassigned',
      pg_catalog.jsonb_build_object('leader_id', p_member_id),
      pg_catalog.jsonb_build_object('leader_id', v_assignment.leader_id)
    );
  end loop;

  with recursive hierarchy_paths(root_id, current_id, next_leader_id, path, cycle_found) as (
    select member.id, member.id, member.leader_id, array[member.id]::uuid[], false
    from public.users as member
    where member.status = 'Active' and member.is_deleted = false
    union all
    select paths.root_id, leader.id, leader.leader_id, paths.path || leader.id,
      leader.id = any(paths.path)
    from hierarchy_paths as paths
    join public.users as leader on leader.id = paths.next_leader_id
    where paths.cycle_found = false and leader.status = 'Active' and leader.is_deleted = false
  )
  select coalesce(pg_catalog.bool_or(paths.cycle_found), false)
  into v_cycle_found from hierarchy_paths as paths;

  if v_cycle_found then
    raise exception 'Downline reassignment would create a reporting cycle' using errcode = '23514';
  end if;

  update public.users as member set status = 'Resigned' where member.id = p_member_id;

  if exists (
    select 1 from public.users as child
    where child.leader_id = p_member_id and child.status = 'Active' and child.is_deleted = false
  ) then
    raise exception 'Active direct downlines remain assigned to the resigned member' using errcode = 'P0001';
  end if;

  return query select true;
end;
$$;

create or replace function public.reactivate_falconhub_user(p_target_auth_user_id uuid)
returns table (success boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_auth_user_id uuid := auth.uid();
  v_actor_profile public.user_profiles%rowtype;
  v_target_profile public.user_profiles%rowtype;
begin
  if v_actor_auth_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('falconhub_admin_user_management'));

  select * into v_actor_profile from public.user_profiles
  where auth_user_id = v_actor_auth_user_id for update;
  if not found or v_actor_profile.status <> 'active'
     or v_actor_profile.role not in ('super_admin', 'admin') then
    raise exception 'Active Admin or Super Admin access is required' using errcode = '42501';
  end if;

  select * into v_target_profile from public.user_profiles
  where auth_user_id = p_target_auth_user_id for update;
  if not found then raise exception 'Falcon Hub account not found' using errcode = 'P0002'; end if;
  if v_actor_profile.role = 'admin' and v_target_profile.role = 'super_admin' then
    raise exception 'Admins cannot modify a Super Admin account' using errcode = '42501';
  end if;
  if v_target_profile.status <> 'inactive' then
    raise exception 'Only inactive Falcon Hub access can be reactivated' using errcode = '23514';
  end if;
  if v_target_profile.member_id is null then
    raise exception 'Linked member profile is required before reactivation' using errcode = '23502';
  end if;
  if not exists (
    select 1 from public.users as member
    where member.id = v_target_profile.member_id
      and member.is_deleted = false and member.status = 'Active'
  ) then
    raise exception 'The linked member must be Active before access can be reactivated' using errcode = '23514';
  end if;

  update public.user_profiles set status = 'active'
  where auth_user_id = p_target_auth_user_id and status = 'inactive';
  if not found then raise exception 'Falcon Hub access is no longer inactive' using errcode = '23514'; end if;

  insert into public.admin_user_audit_logs (
    actor_auth_user_id, target_auth_user_id, target_member_id,
    action, old_values, new_values
  ) values (
    v_actor_auth_user_id, p_target_auth_user_id, v_target_profile.member_id,
    'falcon_hub_access_reactivated',
    pg_catalog.jsonb_build_object('status', 'inactive'),
    pg_catalog.jsonb_build_object('status', 'active')
  );
  return query select true;
end;
$$;

drop policy if exists "Users can read their own private details" on public.user_private_details;
create policy "Users can read their own private details"
on public.user_private_details for select to authenticated
using (exists (
  select 1 from public.user_profiles as profile
  where profile.auth_user_id = auth.uid()
    and profile.member_id = user_private_details.user_id
    and profile.status = 'active'
));

drop policy if exists "Users can update their own private details" on public.user_private_details;
create policy "Users can update their own private details"
on public.user_private_details for update to authenticated
using (exists (
  select 1 from public.user_profiles as profile
  where profile.auth_user_id = auth.uid()
    and profile.member_id = user_private_details.user_id
    and profile.status = 'active'
))
with check (exists (
  select 1 from public.user_profiles as profile
  where profile.auth_user_id = auth.uid()
    and profile.member_id = user_private_details.user_id
    and profile.status = 'active'
));

revoke all on function public.guard_resigned_member_status_change() from public, anon, authenticated;
revoke all on function public.resign_falconhub_member(uuid, jsonb) from public, anon;
grant execute on function public.resign_falconhub_member(uuid, jsonb) to authenticated;
grant execute on function public.resign_falconhub_member(uuid, jsonb) to service_role;

revoke execute on function public.deactivate_falconhub_user(uuid) from public, anon;
grant execute on function public.deactivate_falconhub_user(uuid) to authenticated, service_role;
revoke execute on function public.reactivate_falconhub_user(uuid) from public, anon;
grant execute on function public.reactivate_falconhub_user(uuid) to authenticated, service_role;

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.resign_falconhub_member(uuid,jsonb)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.deactivate_falconhub_user(uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.reactivate_falconhub_user(uuid)', 'EXECUTE') then
    raise exception 'anon retains an unexpected member access-management privilege' using errcode = '42501';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.resign_falconhub_member(uuid,jsonb)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.deactivate_falconhub_user(uuid)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.reactivate_falconhub_user(uuid)', 'EXECUTE') then
    raise exception 'authenticated member access-management privileges are incomplete' using errcode = '42501';
  end if;
end;
$$;

commit;
