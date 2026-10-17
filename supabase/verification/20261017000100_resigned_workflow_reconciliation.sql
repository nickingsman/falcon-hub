-- SELECT-only post-migration reconciliation for 20261017000100_add_resigned_member_workflow.sql.
-- Compare the DATA RECONCILIATION row exactly with the saved preflight baseline.
with recursive
users_relation as (
  select
    owner_role.rolname as owner_name,
    table_row.relrowsecurity,
    table_row.relforcerowsecurity
  from pg_catalog.pg_class as table_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = table_row.relowner
  where schema_row.nspname = 'public'
    and table_row.relname = 'users'
    and table_row.relkind in ('r', 'p')
),
client_privileges as (
  select
    role_name,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'SELECT') as can_select,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'INSERT') as can_insert,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'UPDATE') as can_update,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'DELETE') as can_delete
  from (values ('anon'::text), ('authenticated'::text), ('service_role'::text)) as roles(role_name)
),
expected_constraints as (
  select
    table_row.relname as table_name,
    constraint_row.conname as constraint_name,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) as definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as table_row on table_row.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and constraint_row.contype = 'c'
    and constraint_row.conname in ('users_status_check', 'admin_user_audit_logs_action_check')
),
relevant_functions as (
  select
    function_row.oid,
    function_row.proname,
    pg_catalog.pg_get_function_identity_arguments(function_row.oid) as identity_arguments,
    owner_role.rolname as owner_name,
    owner_role.rolbypassrls as owner_bypasses_rls,
    function_row.prosecdef,
    function_row.proconfig,
    pg_catalog.pg_get_functiondef(function_row.oid) as definition,
    pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE') as anon_execute,
    pg_catalog.has_function_privilege('authenticated', function_row.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('service_role', function_row.oid, 'EXECUTE') as service_role_execute
  from pg_catalog.pg_proc as function_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = function_row.pronamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = function_row.proowner
  where schema_row.nspname = 'public'
    and function_row.prokind = 'f'
    and function_row.proname in (
      'deactivate_falconhub_user',
      'reactivate_falconhub_user',
      'guard_resigned_member_status_change',
      'resign_falconhub_member'
    )
),
function_state as (
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'signature', function_row.proname || '(' || function_row.identity_arguments || ')',
      'owner', function_row.owner_name,
      'owner_bypasses_rls', function_row.owner_bypasses_rls,
      'security_definer', function_row.prosecdef,
      'configuration', function_row.proconfig,
      'uses_shared_admin_lock', function_row.definition like '%falconhub_admin_user_management%',
      'anon_execute', function_row.anon_execute,
      'authenticated_execute', function_row.authenticated_execute,
      'service_role_execute', function_row.service_role_execute
    ) order by function_row.proname
  ), '[]'::jsonb) as details
  from relevant_functions as function_row
),
policy_state as (
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'name', policy_row.policyname,
      'command', policy_row.cmd,
      'roles', policy_row.roles,
      'using', policy_row.qual,
      'with_check', policy_row.with_check
    ) order by policy_row.policyname
  ), '[]'::jsonb) as details
  from pg_catalog.pg_policies as policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'user_private_details'
    and policy_row.policyname in (
      'Users can read their own private details',
      'Users can update their own private details'
    )
),
hierarchy_paths(root_id, current_id, next_leader_id, path, cycle_found) as (
  select member.id, member.id, member.leader_id, array[member.id]::uuid[], false
  from public.users as member where member.is_deleted = false
  union all
  select paths.root_id, leader.id, leader.leader_id, paths.path || leader.id,
    leader.id = any(paths.path)
  from hierarchy_paths as paths
  join public.users as leader on leader.id = paths.next_leader_id
  where not paths.cycle_found and leader.is_deleted = false
),
hierarchy_state as (
  select pg_catalog.jsonb_build_object(
    'leader_relationships', (select pg_catalog.count(*) from public.users where leader_id is not null),
    'cycle_roots', (
      select pg_catalog.count(distinct root_id) from hierarchy_paths where cycle_found
    ),
    'active_children_of_resigned_members', (
      select pg_catalog.count(*)
      from public.users as child
      join public.users as leader on leader.id = child.leader_id
      where child.status = 'Active' and child.is_deleted = false
        and leader.status = 'Resigned'
    ),
    'active_profiles_linked_to_resigned_members', (
      select pg_catalog.count(*)
      from public.user_profiles as profile
      join public.users as member on member.id = profile.member_id
      where profile.status = 'active' and member.status = 'Resigned'
    )
  ) as details
),
role_and_status_state as (
  select pg_catalog.jsonb_build_object(
    'active_super_admins', (
      select pg_catalog.count(*) from public.user_profiles
      where role = 'super_admin' and status = 'active'
    ),
    'member_statuses', (
      select coalesce(pg_catalog.jsonb_object_agg(status_key, status_count), '{}'::jsonb)
      from (
        select status as status_key, pg_catalog.count(*) as status_count
        from public.users group by status
      ) as grouped_statuses
    ),
    'profile_statuses', (
      select coalesce(pg_catalog.jsonb_object_agg(status_key, status_count), '{}'::jsonb)
      from (
        select status as status_key, pg_catalog.count(*) as status_count
        from public.user_profiles group by status
      ) as grouped_profiles
    )
  ) as details
),
data_reconciliation as (
  select pg_catalog.jsonb_build_object(
    'sales_count', (select pg_catalog.count(*) from public.sales_cases),
    'sales_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(row_data)::text, '|' order by row_data.id::text), ''
    )) from public.sales_cases as row_data),
    'contributor_count', (select pg_catalog.count(*) from public.sales_case_contributors),
    'contributor_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(row_data)::text, '|' order by row_data.id::text), ''
    )) from public.sales_case_contributors as row_data),
    'users_count', (select pg_catalog.count(*) from public.users),
    'users_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(row_data)::text, '|' order by row_data.id::text), ''
    )) from public.users as row_data),
    'profiles_count', (select pg_catalog.count(*) from public.user_profiles),
    'profiles_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(row_data)::text, '|' order by row_data.auth_user_id::text), ''
    )) from public.user_profiles as row_data),
    'audit_count', (select pg_catalog.count(*) from public.admin_user_audit_logs),
    'audit_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(row_data)::text, '|' order by row_data.id::text), ''
    )) from public.admin_user_audit_logs as row_data),
    'hierarchy_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(
        row_data.id::text || ':' || coalesce(row_data.leader_id::text, '') || ':' ||
        coalesce(row_data.status, '') || ':' || coalesce(row_data.is_deleted::text, ''),
        '|' order by row_data.id::text
      ), ''
    )) from public.users as row_data)
  ) as details
),
storage_state as (
  select pg_catalog.jsonb_build_object(
    'storage_objects_rls', storage_table.relrowsecurity,
    'project_media_public', (
      select bucket.public from storage.buckets as bucket where bucket.id = 'project-media'
    )
  ) as details
  from pg_catalog.pg_class as storage_table
  where storage_table.oid = pg_catalog.to_regclass('storage.objects')
),
report as (
  select 10 as sort_order, 'DATA RECONCILIATION'::text as section,
    'Compare exactly with saved preflight baseline'::text as check_name,
    'MANUAL COMPARE'::text as result_status, data_row.details
  from data_reconciliation as data_row

  union all
  select 20, 'PUBLIC.USERS', 'RLS and client privileges remain hardened',
    case when users_table.relrowsecurity and not users_table.relforcerowsecurity
      and not exists (
        select 1 from client_privileges as privilege_row
        where privilege_row.role_name in ('anon', 'authenticated')
          and (privilege_row.can_select or privilege_row.can_insert
            or privilege_row.can_update or privilege_row.can_delete)
      ) then 'PASS' else 'FAIL' end,
    pg_catalog.jsonb_build_object(
      'table', pg_catalog.to_jsonb(users_table),
      'privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.role_name) from client_privileges as p)
    )
  from users_relation as users_table

  union all
  select 30, 'CONSTRAINTS', 'Resigned status and audit actions installed',
    case when (select pg_catalog.count(*) from expected_constraints) = 2
      and exists (select 1 from expected_constraints where table_name = 'users' and definition like '%Resigned%')
      and exists (select 1 from expected_constraints where table_name = 'admin_user_audit_logs'
        and definition like '%member_resigned%' and definition like '%member_downline_reassigned%')
      then 'PASS' else 'FAIL' end,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.table_name) from expected_constraints as c), '[]'::jsonb)

  union all
  select 40, 'FUNCTIONS', 'Security, shared lock, and effective EXECUTE grants',
    case when (select pg_catalog.count(*) from relevant_functions) = 4
      and not exists (
        select 1 from relevant_functions as function_row
        where not function_row.prosecdef
          or (function_row.owner_name <> (select owner_name from users_relation)
            and not function_row.owner_bypasses_rls)
          or function_row.anon_execute
      )
      and exists (select 1 from relevant_functions where proname = 'resign_falconhub_member'
        and authenticated_execute and service_role_execute
        and definition like '%falconhub_admin_user_management%')
      and exists (select 1 from relevant_functions where proname = 'deactivate_falconhub_user'
        and authenticated_execute and service_role_execute
        and definition like '%falconhub_admin_user_management%')
      and exists (select 1 from relevant_functions where proname = 'reactivate_falconhub_user'
        and authenticated_execute and service_role_execute
        and definition like '%falconhub_admin_user_management%')
      and exists (select 1 from relevant_functions where proname = 'guard_resigned_member_status_change'
        and not authenticated_execute
        and definition like '%falconhub_admin_user_management%')
      then 'PASS' else 'FAIL' end,
    function_row.details
  from function_state as function_row

  union all
  select 50, 'TRIGGER', 'Resignation status guard installed',
    case when exists (
      select 1 from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.users'::pg_catalog.regclass
        and trigger_row.tgname = 'guard_resigned_member_status_change'
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled <> 'D'
    ) then 'PASS' else 'FAIL' end,
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', trigger_row.tgname,
        'enabled', trigger_row.tgenabled,
        'definition', pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
      ))
      from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.users'::pg_catalog.regclass
        and trigger_row.tgname = 'guard_resigned_member_status_change'
        and not trigger_row.tgisinternal
    ), '[]'::jsonb)

  union all
  select 60, 'RLS', 'Private-details active-account policies',
    case when pg_catalog.jsonb_array_length(policy_row.details) = 2
      and policy_row.details::text like '%profile.status = ''active''%'
      then 'PASS' else 'FAIL' end,
    policy_row.details
  from policy_state as policy_row

  union all
  select 70, 'ROLES', 'Super Admin and status distributions',
    case when (role_row.details->>'active_super_admins')::integer >= 1 then 'PASS' else 'FAIL' end,
    role_row.details
  from role_and_status_state as role_row

  union all
  select 80, 'HIERARCHY', 'Cycle and resigned-member integrity',
    case when (hierarchy_row.details->>'cycle_roots')::integer = 0
      and (hierarchy_row.details->>'active_children_of_resigned_members')::integer = 0
      and (hierarchy_row.details->>'active_profiles_linked_to_resigned_members')::integer = 0
      then 'PASS' else 'FAIL' end,
    hierarchy_row.details
  from hierarchy_state as hierarchy_row

  union all
  select 90, 'STORAGE', 'Existing-session media assumptions unchanged',
    case when storage_row.details->>'storage_objects_rls' = 'true'
      and storage_row.details->>'project_media_public' = 'false'
      then 'PASS' else 'FAIL' end,
    storage_row.details
  from storage_state as storage_row
)
select section, check_name, result_status, details
from report
order by sort_order;
