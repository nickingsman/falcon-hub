begin;

do $$
declare
  v_users_owner oid;
begin
  if pg_catalog.to_regclass('public.users') is null then
    raise exception 'public.users does not exist' using errcode = '42P01';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_roles as role_row
    where role_row.rolname = 'service_role'
      and role_row.rolbypassrls
  ) then
    raise exception 'service_role must exist and have BYPASSRLS' using errcode = '42501';
  end if;

  if pg_catalog.to_regclass('public.users_member_code_seq') is null then
    raise exception 'public.users_member_code_seq does not exist' using errcode = '42P01';
  end if;

  select table_row.relowner
  into v_users_owner
  from pg_catalog.pg_class as table_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and table_row.relname = 'users'
    and table_row.relkind in ('r', 'p');

  if v_users_owner is null then
    raise exception 'Unable to resolve public.users owner' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as table_row
    join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'users'
      and table_row.relforcerowsecurity
  ) then
    raise exception 'public.users unexpectedly has FORCE ROW LEVEL SECURITY enabled' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as policy_row
    where policy_row.schemaname = 'public'
      and policy_row.tablename = 'users'
  ) then
    raise exception 'Unexpected public.users RLS policies exist; review before hardening'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as function_row
    join pg_catalog.pg_namespace as schema_row on schema_row.oid = function_row.pronamespace
    join pg_catalog.pg_roles as owner_role on owner_role.oid = function_row.proowner
    where schema_row.nspname = 'public'
      and function_row.prokind = 'f'
      and (
        pg_catalog.pg_get_functiondef(function_row.oid) like '%public.users%'
        or function_row.proname in (
          'complete_user_profile',
          'complete_user_profile_with_display_name',
          'manage_falconhub_user',
          'manage_falconhub_user_with_display_name',
          'deactivate_falconhub_user',
          'reactivate_falconhub_user',
          'ensure_leader_promotion_request',
          'decide_leader_promotion_request',
          'backfill_leader_promotion_requests',
          'trigger_leader_promotion_request_from_member',
          'trigger_leader_promotion_request_from_profile',
          'import_historical_sales_case',
          'import_historical_sales_case_v2',
          'verify_historical_sales_allocation',
          'resign_falconhub_member',
          'guard_resigned_member_status_change'
        )
      )
      and (
        not function_row.prosecdef
        or (
          function_row.proowner <> v_users_owner
          and not owner_role.rolbypassrls
        )
      )
  ) then
    raise exception 'A controlled function using public.users is not RLS-compatible'
      using errcode = 'P0001';
  end if;
end;
$$;

alter table public.users enable row level security;

revoke all privileges on table public.users from public, anon, authenticated;

-- Column grants are independent from table grants and must be removed explicitly.
do $$
declare
  v_columns text;
begin
  select pg_catalog.string_agg(
    pg_catalog.format('%I', attribute_row.attname),
    ', '
    order by attribute_row.attnum
  )
  into v_columns
  from pg_catalog.pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.users'::pg_catalog.regclass
    and attribute_row.attnum > 0
    and not attribute_row.attisdropped;

  if v_columns is null then
    raise exception 'public.users columns could not be resolved' using errcode = 'P0001';
  end if;

  execute pg_catalog.format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s)
       on table public.users
       from public, anon, authenticated',
    v_columns
  );
end;
$$;

grant select, insert, update, delete on table public.users to service_role;

do $$
begin
  execute 'revoke all privileges on sequence public.users_member_code_seq
    from public, anon, authenticated';
  execute 'grant usage, select on sequence public.users_member_code_seq to service_role';
end;
$$;

do $$
begin
  if not (
    select table_row.relrowsecurity
    from pg_catalog.pg_class as table_row
    join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'users'
  ) then
    raise exception 'public.users RLS was not enabled' using errcode = 'P0001';
  end if;

  if (
    select table_row.relforcerowsecurity
    from pg_catalog.pg_class as table_row
    join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'users'
  ) then
    raise exception 'public.users must not use FORCE ROW LEVEL SECURITY' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as policy_row
    where policy_row.schemaname = 'public'
      and policy_row.tablename = 'users'
  ) then
    raise exception 'public.users must remain default-deny with no client policies'
      using errcode = 'P0001';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.users', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'INSERT')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'UPDATE')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'DELETE')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'TRUNCATE')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'REFERENCES')
     or pg_catalog.has_table_privilege('anon', 'public.users', 'TRIGGER')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'REFERENCES')
     or pg_catalog.has_table_privilege('authenticated', 'public.users', 'TRIGGER') then
    raise exception 'A client role retains an effective public.users privilege'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.users'::pg_catalog.regclass
      and attribute_row.attnum > 0
      and not attribute_row.attisdropped
      and (
        pg_catalog.has_column_privilege('anon', 'public.users', attribute_row.attname, 'SELECT')
        or pg_catalog.has_column_privilege('anon', 'public.users', attribute_row.attname, 'INSERT')
        or pg_catalog.has_column_privilege('anon', 'public.users', attribute_row.attname, 'UPDATE')
        or pg_catalog.has_column_privilege('authenticated', 'public.users', attribute_row.attname, 'SELECT')
        or pg_catalog.has_column_privilege('authenticated', 'public.users', attribute_row.attname, 'INSERT')
        or pg_catalog.has_column_privilege('authenticated', 'public.users', attribute_row.attname, 'UPDATE')
      )
  ) then
    raise exception 'A client role retains an effective public.users column privilege'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.users', 'SELECT')
     or not pg_catalog.has_table_privilege('service_role', 'public.users', 'INSERT')
     or not pg_catalog.has_table_privilege('service_role', 'public.users', 'UPDATE')
     or not pg_catalog.has_table_privilege('service_role', 'public.users', 'DELETE') then
    raise exception 'service_role public.users privileges are incomplete' using errcode = '42501';
  end if;

  if pg_catalog.has_sequence_privilege('anon', 'public.users_member_code_seq', 'USAGE')
     or pg_catalog.has_sequence_privilege('anon', 'public.users_member_code_seq', 'SELECT')
     or pg_catalog.has_sequence_privilege('anon', 'public.users_member_code_seq', 'UPDATE')
     or pg_catalog.has_sequence_privilege('authenticated', 'public.users_member_code_seq', 'USAGE')
     or pg_catalog.has_sequence_privilege('authenticated', 'public.users_member_code_seq', 'SELECT')
     or pg_catalog.has_sequence_privilege('authenticated', 'public.users_member_code_seq', 'UPDATE') then
    raise exception 'A client role retains an effective member-code sequence privilege'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_sequence_privilege(
    'service_role',
    'public.users_member_code_seq',
    'USAGE'
  ) then
    raise exception 'service_role member-code sequence access is incomplete'
      using errcode = '42501';
  end if;
end;
$$;

commit;
