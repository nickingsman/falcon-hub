create or replace function public.manage_falconhub_user(
  p_target_auth_user_id uuid,
  p_role text default null,
  p_update_member_profile boolean default false,
  p_position text default null,
  p_employment_type text default null,
  p_leader_id uuid default null,
  p_join_date date default null,
  p_member_status text default null
)
returns table (
  success boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_auth_user_id uuid;
  v_actor_profile public.user_profiles%rowtype;
  v_target_profile public.user_profiles%rowtype;
  v_target_member public.users%rowtype;
  v_next_role text;
  v_position text;
  v_employment_type text;
  v_member_status text;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_active_super_admin_count integer;
  v_cycle_found boolean := false;
begin
  v_actor_auth_user_id := auth.uid();

  if v_actor_auth_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('falconhub_admin_user_management')
  );

  select *
  into v_actor_profile
  from public.user_profiles as actor_profile
  where actor_profile.auth_user_id = v_actor_auth_user_id
  for update;

  if not found or v_actor_profile.status <> 'active' then
    raise exception 'Active admin profile is required'
      using errcode = '42501';
  end if;

  if v_actor_profile.role not in ('super_admin', 'admin') then
    raise exception 'User management access is required'
      using errcode = '42501';
  end if;

  select *
  into v_target_profile
  from public.user_profiles as target_profile
  where target_profile.auth_user_id = p_target_auth_user_id
  for update;

  if not found then
    raise exception 'Falcon Hub account not found'
      using errcode = 'P0002';
  end if;

  v_next_role := nullif(pg_catalog.btrim(p_role), '');

  if v_next_role is not null and v_next_role not in ('super_admin', 'admin', 'leader', 'agent') then
    raise exception 'Role is invalid'
      using errcode = '22023';
  end if;

  if v_actor_profile.role = 'admin' and v_target_profile.role = 'super_admin' then
    raise exception 'Admins cannot modify a Super Admin account'
      using errcode = '42501';
  end if;

  if v_actor_profile.role = 'admin' and v_next_role = 'super_admin' then
    raise exception 'Admins cannot assign Super Admin'
      using errcode = '42501';
  end if;

  if (
    v_next_role is not null and
    v_next_role is distinct from v_target_profile.role and
    p_target_auth_user_id = v_actor_auth_user_id
  ) then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;

  if (
    v_next_role is not null and
    v_target_profile.role = 'super_admin' and
    v_target_profile.status = 'active' and
    v_next_role is distinct from 'super_admin'
  ) then
    select pg_catalog.count(*)
    into v_active_super_admin_count
    from public.user_profiles as super_admin_profile
    where super_admin_profile.role = 'super_admin'
      and super_admin_profile.status = 'active';

    if v_active_super_admin_count <= 1 then
      raise exception 'The final active Super Admin cannot be demoted'
        using errcode = '42501';
    end if;
  end if;

  if p_update_member_profile then
    if v_target_profile.member_id is null then
      raise exception 'Linked member profile is required'
        using errcode = '23502';
    end if;

    v_position := nullif(pg_catalog.btrim(p_position), '');
    v_employment_type := nullif(pg_catalog.btrim(p_employment_type), '');
    v_member_status := nullif(pg_catalog.btrim(p_member_status), '');

    if v_position is null or v_position not in (
      'Managing Partner',
      'Project Manager',
      'Group Leader',
      'Senior Team Leader',
      'Team Leader',
      'Senior REN',
      'REN 75',
      'REN 70'
    ) then
      raise exception 'Position is invalid'
        using errcode = '22023';
    end if;

    if v_employment_type is null or v_employment_type not in (
      'Core Agent',
      'Part Time Agent'
    ) then
      raise exception 'Employment type is invalid'
        using errcode = '22023';
    end if;

    if v_member_status is null or v_member_status not in (
      'Active',
      'Review',
      'Pending'
    ) then
      raise exception 'Member status is invalid'
        using errcode = '22023';
    end if;

    select *
    into v_target_member
    from public.users as target_member
    where target_member.id = v_target_profile.member_id
      and target_member.is_deleted = false
    for update;

    if not found then
      raise exception 'Linked member profile was not found'
        using errcode = 'P0002';
    end if;

    if p_leader_id is not null then
      if p_leader_id = v_target_profile.member_id then
        raise exception 'A member cannot be their own leader'
          using errcode = '22023';
      end if;

      if not exists (
        select 1
        from public.users as leader
        where leader.id = p_leader_id
          and leader.is_deleted = false
          and leader.status = 'Active'
      ) then
        raise exception 'Leader must be an active member'
          using errcode = '23503';
      end if;

      with recursive descendants(id, leader_id, path) as (
        select child.id, child.leader_id, array[v_target_profile.member_id, child.id]::uuid[]
        from public.users as child
        where child.leader_id = v_target_profile.member_id
          and child.is_deleted = false

        union all

        select child.id, child.leader_id, descendants.path || child.id
        from public.users as child
        join descendants on child.leader_id = descendants.id
        where child.is_deleted = false
          and child.id <> all(descendants.path)
      )
      select exists (
        select 1
        from descendants
        where descendants.id = p_leader_id
      )
      into v_cycle_found;

      if v_cycle_found then
        raise exception 'Leader change would create a reporting cycle'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if v_next_role is not null and v_next_role is distinct from v_target_profile.role then
    update public.user_profiles as target_profile
    set role = v_next_role
    where target_profile.auth_user_id = p_target_auth_user_id;

    insert into public.admin_user_audit_logs (
      actor_auth_user_id,
      target_auth_user_id,
      target_member_id,
      action,
      old_values,
      new_values
    )
    values (
      v_actor_auth_user_id,
      p_target_auth_user_id,
      v_target_profile.member_id,
      'role_changed',
      pg_catalog.jsonb_build_object('role', v_target_profile.role),
      pg_catalog.jsonb_build_object('role', v_next_role)
    );
  end if;

  if p_update_member_profile then
    if v_target_member.position is distinct from v_position then
      v_old_values := v_old_values || pg_catalog.jsonb_build_object('position', v_target_member.position);
      v_new_values := v_new_values || pg_catalog.jsonb_build_object('position', v_position);
    end if;

    if v_target_member.employment_type is distinct from v_employment_type then
      v_old_values := v_old_values || pg_catalog.jsonb_build_object('employment_type', v_target_member.employment_type);
      v_new_values := v_new_values || pg_catalog.jsonb_build_object('employment_type', v_employment_type);
    end if;

    if v_target_member.leader_id is distinct from p_leader_id then
      v_old_values := v_old_values || pg_catalog.jsonb_build_object('leader_id', v_target_member.leader_id);
      v_new_values := v_new_values || pg_catalog.jsonb_build_object('leader_id', p_leader_id);
    end if;

    if v_target_member.join_date is distinct from p_join_date then
      v_old_values := v_old_values || pg_catalog.jsonb_build_object('join_date', v_target_member.join_date);
      v_new_values := v_new_values || pg_catalog.jsonb_build_object('join_date', p_join_date);
    end if;

    if v_target_member.status is distinct from v_member_status then
      v_old_values := v_old_values || pg_catalog.jsonb_build_object('status', v_target_member.status);
      v_new_values := v_new_values || pg_catalog.jsonb_build_object('status', v_member_status);
    end if;

    if v_new_values <> '{}'::jsonb then
      update public.users as target_member
      set
        position = v_position,
        employment_type = v_employment_type,
        leader_id = p_leader_id,
        join_date = p_join_date,
        status = v_member_status
      where target_member.id = v_target_profile.member_id
        and target_member.is_deleted = false;

      insert into public.admin_user_audit_logs (
        actor_auth_user_id,
        target_auth_user_id,
        target_member_id,
        action,
        old_values,
        new_values
      )
      values (
        v_actor_auth_user_id,
        p_target_auth_user_id,
        v_target_profile.member_id,
        'member_profile_updated',
        v_old_values,
        v_new_values
      );
    end if;
  end if;

  return query select true;
end;
$$;

revoke all on function public.manage_falconhub_user(uuid, text, boolean, text, text, uuid, date, text)
from public;

grant execute on function public.manage_falconhub_user(uuid, text, boolean, text, text, uuid, date, text)
to authenticated;
