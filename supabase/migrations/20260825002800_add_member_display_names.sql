alter table public.users
  add column if not exists display_name text null;

alter table public.users
  drop constraint if exists users_display_name_check;

alter table public.users
  add constraint users_display_name_check
  check (
    display_name is null
    or (
      display_name = pg_catalog.btrim(display_name)
      and pg_catalog.char_length(display_name) between 1 and 80
    )
  );

create or replace function public.complete_user_profile_with_display_name(
  p_full_name text,
  p_display_name text,
  p_chinese_name text,
  p_phone text,
  p_birthday date,
  p_nric_number text
)
returns table (
  member_id uuid,
  full_name text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_member_id uuid;
  v_full_name text;
  v_display_name text;
begin
  v_display_name := nullif(pg_catalog.btrim(p_display_name), '');

  if v_display_name is not null and pg_catalog.char_length(v_display_name) > 80 then
    raise exception 'Display Name must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  select completed.member_id, completed.full_name
  into v_member_id, v_full_name
  from public.complete_user_profile(
    p_full_name,
    p_chinese_name,
    p_phone,
    p_birthday,
    p_nric_number
  ) as completed;

  update public.users as member
  set display_name = v_display_name
  where member.id = v_member_id;

  return query select v_member_id, v_full_name;
end;
$$;

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
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_display_name text;
  v_member_id uuid;
begin
  if p_update_member_profile then
    v_display_name := nullif(pg_catalog.btrim(p_display_name), '');
    if v_display_name is not null and pg_catalog.char_length(v_display_name) > 80 then
      raise exception 'Display Name must be 80 characters or fewer'
        using errcode = '22023';
    end if;
  end if;

  perform *
  from public.manage_falconhub_user(
    p_target_auth_user_id,
    p_role,
    p_update_member_profile,
    p_position,
    p_employment_type,
    p_leader_id,
    p_join_date,
    p_member_status
  );

  if p_update_member_profile then
    select profile.member_id
    into v_member_id
    from public.user_profiles as profile
    where profile.auth_user_id = p_target_auth_user_id;

    update public.users as member
    set display_name = v_display_name
    where member.id = v_member_id;
  end if;

  return query select true;
end;
$$;

revoke all on function public.complete_user_profile_with_display_name(text, text, text, text, date, text)
from public;
grant execute on function public.complete_user_profile_with_display_name(text, text, text, text, date, text)
to authenticated;

revoke all on function public.manage_falconhub_user_with_display_name(uuid, text, boolean, text, text, text, uuid, date, text)
from public;
grant execute on function public.manage_falconhub_user_with_display_name(uuid, text, boolean, text, text, text, uuid, date, text)
to authenticated;
