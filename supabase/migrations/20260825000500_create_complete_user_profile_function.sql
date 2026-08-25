create or replace function public.complete_user_profile(
  p_full_name text,
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
  v_auth_user_id uuid;
  v_email text;
  v_profile public.user_profiles%rowtype;
  v_member_id uuid;
  v_full_name text;
  v_chinese_name text;
  v_phone text;
  v_nric_number text;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  v_full_name := nullif(pg_catalog.btrim(p_full_name), '');
  v_chinese_name := nullif(pg_catalog.btrim(p_chinese_name), '');
  v_phone := nullif(pg_catalog.btrim(p_phone), '');
  v_nric_number := pg_catalog.regexp_replace(
    coalesce(p_nric_number, ''),
    '[[:space:]-]',
    '',
    'g'
  );

  if v_full_name is null then
    raise exception 'Full Name is required'
      using errcode = '22023';
  end if;

  if v_phone is null then
    raise exception 'Phone is required'
      using errcode = '22023';
  end if;

  if p_birthday is null then
    raise exception 'Birthday is required'
      using errcode = '22023';
  end if;

  if v_nric_number !~ '^\d{12}$' then
    raise exception 'NRIC must contain exactly 12 digits'
      using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.user_profiles as up
  where up.auth_user_id = v_auth_user_id
  for update;

  if not found then
    raise exception 'User profile is required'
      using errcode = '28000';
  end if;

  if v_profile.status <> 'pending_profile' then
    raise exception 'Profile is not pending completion'
      using errcode = '42501';
  end if;

  if v_profile.member_id is not null then
    raise exception 'Profile has already been completed'
      using errcode = '23505';
  end if;

  if nullif(pg_catalog.btrim(v_profile.approved_position), '') is null then
    raise exception 'Approved position is required'
      using errcode = '23502';
  end if;

  if nullif(pg_catalog.btrim(v_profile.approved_employment_type), '') is null then
    raise exception 'Approved employment type is required'
      using errcode = '23502';
  end if;

  if v_profile.approved_join_date is null then
    raise exception 'Approved join date is required'
      using errcode = '23502';
  end if;

  if v_profile.approved_leader_id is not null and not exists (
    select 1
    from public.users as leader
    where leader.id = v_profile.approved_leader_id
      and leader.is_deleted = false
      and leader.status = 'Active'
  ) then
    raise exception 'Approved leader is no longer active'
      using errcode = '23503';
  end if;

  select au.email
  into v_email
  from auth.users as au
  where au.id = v_auth_user_id;

  if nullif(pg_catalog.btrim(v_email), '') is null then
    raise exception 'Authenticated email is required'
      using errcode = '23502';
  end if;

  insert into public.users as new_user (
    full_name,
    chinese_name,
    email,
    phone,
    birthday,
    join_date,
    position,
    employment_type,
    leader_id,
    status
  )
  values (
    v_full_name,
    v_chinese_name,
    v_email,
    v_phone,
    p_birthday,
    v_profile.approved_join_date,
    v_profile.approved_position,
    v_profile.approved_employment_type,
    v_profile.approved_leader_id,
    'Active'
  )
  returning new_user.id into v_member_id;

  insert into public.user_private_details (
    user_id,
    nric_number
  )
  values (
    v_member_id,
    v_nric_number
  );

  update public.user_profiles as up
  set
    member_id = v_member_id,
    status = 'active'
  where up.auth_user_id = v_auth_user_id
    and up.status = 'pending_profile'
    and up.member_id is null;

  if not found then
    raise exception 'Profile has already been completed'
      using errcode = '23505';
  end if;

  return query
  select v_member_id, v_full_name;
end;
$$;

revoke all on function public.complete_user_profile(text, text, text, date, text)
from public;

grant execute on function public.complete_user_profile(text, text, text, date, text)
to authenticated;
