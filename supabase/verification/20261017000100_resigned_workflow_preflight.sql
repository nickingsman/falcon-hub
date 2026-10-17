-- SELECT-only production preflight for 20261017000100_add_resigned_member_workflow.sql.
-- Save the DATA BASELINE row for exact comparison with the post-migration report.
with recursive
users_relation as (
  select
    table_row.oid,
    owner_role.rolname as owner_name,
    table_row.relrowsecurity,
    table_row.relforcerowsecurity,
    table_row.relacl::text as raw_acl,
    current_user as execution_role,
    current_role_row.rolbypassrls as execution_role_bypasses_rls
  from pg_catalog.pg_class as table_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = table_row.relowner
  join pg_catalog.pg_roles as current_role_row on current_role_row.rolname = current_user
  where schema_row.nspname = 'public'
    and table_row.relname = 'users'
    and table_row.relkind in ('r', 'p')
),
client_table_privileges as (
  select
    role_name,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'SELECT') as can_select,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'INSERT') as can_insert,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'UPDATE') as can_update,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'DELETE') as can_delete,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'TRUNCATE') as can_truncate,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'REFERENCES') as can_reference,
    pg_catalog.has_table_privilege(role_name, 'public.users', 'TRIGGER') as can_trigger
  from (values ('anon'::text), ('authenticated'::text), ('service_role'::text)) as roles(role_name)
),
client_column_privileges as (
  select
    roles.role_name,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      roles.role_name, 'public.users', attribute_row.attname, 'SELECT'
    )), false) as any_select,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      roles.role_name, 'public.users', attribute_row.attname, 'INSERT'
    )), false) as any_insert,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      roles.role_name, 'public.users', attribute_row.attname, 'UPDATE'
    )), false) as any_update,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      roles.role_name, 'public.users', attribute_row.attname, 'REFERENCES'
    )), false) as any_reference
  from (values ('anon'::text), ('authenticated'::text), ('service_role'::text)) as roles(role_name)
  cross join users_relation as users_table
  join pg_catalog.pg_attribute as attribute_row
    on attribute_row.attrelid = users_table.oid
   and attribute_row.attnum > 0
   and not attribute_row.attisdropped
  group by roles.role_name
),
constraint_inventory as (
  select
    schema_row.nspname as schema_name,
    table_row.relname as table_name,
    constraint_row.conname as constraint_name,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) as definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as table_row on table_row.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and constraint_row.contype = 'c'
    and (
      (table_row.relname = 'users'
       and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)) like '%status%')
      or
      (table_row.relname = 'admin_user_audit_logs'
       and pg_catalog.lower(pg_catalog.pg_get_constraintdef(constraint_row.oid, true)) like '%action%')
    )
),
constraint_report as (
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'table', constraint_row.schema_name || '.' || constraint_row.table_name,
        'name', constraint_row.constraint_name,
        'definition', constraint_row.definition,
        'quoted_values', (
          select coalesce(
            pg_catalog.jsonb_agg((extracted.capture)[1] order by (extracted.capture)[1]),
            '[]'::jsonb
          )
          from pg_catalog.regexp_matches(
            constraint_row.definition,
            '''([^'']+)''',
            'g'
          ) as extracted(capture)
        )
      ) order by constraint_row.table_name, constraint_row.constraint_name
    ),
    '[]'::jsonb
  ) as details
  from constraint_inventory as constraint_row
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
      'manage_falconhub_user',
      'manage_falconhub_user_with_display_name',
      'deactivate_falconhub_user',
      'reactivate_falconhub_user',
      'guard_resigned_member_status_change',
      'resign_falconhub_member'
    )
),
function_report as (
  select coalesce(
    pg_catalog.jsonb_agg(
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
      ) order by function_row.proname, function_row.identity_arguments
    ),
    '[]'::jsonb
  ) as details
  from relevant_functions as function_row
),
migration_components as (
  select pg_catalog.jsonb_build_object(
    'guard_function', pg_catalog.to_regprocedure('public.guard_resigned_member_status_change()') is not null,
    'resign_rpc', pg_catalog.to_regprocedure('public.resign_falconhub_member(uuid,jsonb)') is not null,
    'guard_trigger', exists (
      select 1
      from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.users'::pg_catalog.regclass
        and trigger_row.tgname = 'guard_resigned_member_status_change'
        and not trigger_row.tgisinternal
    ),
    'private_details_read_policy', exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_private_details'
        and policyname = 'Users can read their own private details'
    ),
    'private_details_update_policy', exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_private_details'
        and policyname = 'Users can update their own private details'
    )
  ) as details
),
hierarchy_paths(root_id, current_id, next_leader_id, path, cycle_found) as (
  select member.id, member.id, member.leader_id, array[member.id]::uuid[], false
  from public.users as member
  where member.is_deleted = false
  union all
  select paths.root_id, leader.id, leader.leader_id, paths.path || leader.id,
    leader.id = any(paths.path)
  from hierarchy_paths as paths
  join public.users as leader on leader.id = paths.next_leader_id
  where not paths.cycle_found and leader.is_deleted = false
),
hierarchy_health as (
  select pg_catalog.jsonb_build_object(
    'leader_relationships', (select pg_catalog.count(*) from public.users where leader_id is not null),
    'active_direct_relationships', (
      select pg_catalog.count(*) from public.users
      where leader_id is not null and status = 'Active' and is_deleted = false
    ),
    'missing_leader_links', (
      select pg_catalog.count(*) from public.users as member
      where member.leader_id is not null
        and not exists (select 1 from public.users as leader where leader.id = member.leader_id)
    ),
    'self_leader_links', (
      select pg_catalog.count(*) from public.users where leader_id = id
    ),
    'broken_profile_member_links', (
      select pg_catalog.count(*) from public.user_profiles as profile
      where profile.member_id is not null
        and not exists (select 1 from public.users as member where member.id = profile.member_id)
    ),
    'duplicate_profile_member_links', (
      select pg_catalog.count(*) from (
        select profile.member_id from public.user_profiles as profile
        where profile.member_id is not null
        group by profile.member_id having pg_catalog.count(*) > 1
      ) as duplicates
    ),
    'cycle_roots', (
      select pg_catalog.count(distinct paths.root_id) from hierarchy_paths as paths
      where paths.cycle_found
    )
  ) as details
),
role_and_status_state as (
  select pg_catalog.jsonb_build_object(
    'active_super_admins', (
      select pg_catalog.count(*) from public.user_profiles
      where role = 'super_admin' and status = 'active'
    ),
    'profile_roles', (
      select coalesce(pg_catalog.jsonb_object_agg(role_key, role_count), '{}'::jsonb)
      from (
        select role as role_key, pg_catalog.count(*) as role_count
        from public.user_profiles group by role
      ) as grouped_roles
    ),
    'profile_statuses', (
      select coalesce(pg_catalog.jsonb_object_agg(status_key, status_count), '{}'::jsonb)
      from (
        select status as status_key, pg_catalog.count(*) as status_count
        from public.user_profiles group by status
      ) as grouped_statuses
    ),
    'member_statuses', (
      select coalesce(pg_catalog.jsonb_object_agg(status_key, status_count), '{}'::jsonb)
      from (
        select status as status_key, pg_catalog.count(*) as status_count
        from public.users group by status
      ) as grouped_member_statuses
    )
  ) as details
),
data_baseline as (
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
    'storage_objects_exists', storage_table.oid is not null,
    'storage_objects_rls', storage_table.relrowsecurity,
    'storage_objects_force_rls', storage_table.relforcerowsecurity,
    'storage_policy_count', (
      select pg_catalog.count(*) from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
    ),
    'project_media_bucket_exists', exists (
      select 1 from storage.buckets where id = 'project-media'
    ),
    'project_media_public', (
      select bucket.public from storage.buckets as bucket where bucket.id = 'project-media'
    )
  ) as details
  from (select pg_catalog.to_regclass('storage.objects') as oid) as resolved
  left join pg_catalog.pg_class as storage_table on storage_table.oid = resolved.oid
),
report as (
  select 10 as sort_order, 'DATA BASELINE'::text as section,
    'Save for post-migration comparison'::text as check_name,
    'CAPTURE'::text as result_status, baseline.details
  from data_baseline as baseline

  union all
  select 20, 'PUBLIC.USERS', 'Owner, execution role, and RLS hardening',
    case when users_table.relrowsecurity and not users_table.relforcerowsecurity
      and (users_table.execution_role = users_table.owner_name or users_table.execution_role_bypasses_rls)
      then 'PASS' else 'BLOCK' end,
    pg_catalog.to_jsonb(users_table)
  from users_relation as users_table

  union all
  select 30, 'PUBLIC.USERS', 'Effective table privileges',
    case when not exists (
      select 1 from client_table_privileges as privilege_row
      where privilege_row.role_name in ('anon', 'authenticated')
        and (privilege_row.can_select or privilege_row.can_insert or privilege_row.can_update
          or privilege_row.can_delete or privilege_row.can_truncate
          or privilege_row.can_reference or privilege_row.can_trigger)
    ) and exists (
      select 1 from client_table_privileges as privilege_row
      where privilege_row.role_name = 'service_role'
        and privilege_row.can_select and privilege_row.can_insert
        and privilege_row.can_update and privilege_row.can_delete
    ) then 'PASS' else 'BLOCK' end,
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(privilege_row) order by privilege_row.role_name)
  from client_table_privileges as privilege_row

  union all
  select 40, 'PUBLIC.USERS', 'Effective column privileges',
    case when not exists (
      select 1 from client_column_privileges as privilege_row
      where privilege_row.role_name in ('anon', 'authenticated')
        and (privilege_row.any_select or privilege_row.any_insert
          or privilege_row.any_update or privilege_row.any_reference)
    ) then 'PASS' else 'BLOCK' end,
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(privilege_row) order by privilege_row.role_name)
  from client_column_privileges as privilege_row

  union all
  select 50, 'CONSTRAINTS', 'Member status and audit action constraints',
    case when (select pg_catalog.count(*) from constraint_inventory where table_name = 'users') = 1
      and (select pg_catalog.count(*) from constraint_inventory where table_name = 'admin_user_audit_logs') = 1
      then 'REVIEW VALUES' else 'BLOCK' end,
    constraint_row.details
  from constraint_report as constraint_row

  union all
  select 60, 'ACCESS CONTROL', 'Relevant function ownership, locks, and grants',
    case when not exists (
      select 1 from relevant_functions as function_row
      where not function_row.prosecdef
        or (function_row.owner_name <> (select owner_name from users_relation)
          and not function_row.owner_bypasses_rls)
    ) and exists (
      select 1 from relevant_functions
      where proname = 'deactivate_falconhub_user'
        and definition like '%falconhub_admin_user_management%'
    ) and exists (
      select 1 from relevant_functions
      where proname = 'reactivate_falconhub_user'
        and definition like '%falconhub_admin_user_management%'
    ) and exists (
      select 1 from relevant_functions
      where proname = 'manage_falconhub_user'
        and definition like '%falconhub_admin_user_management%'
    ) then 'PASS' else 'BLOCK' end,
    function_row.details
  from function_report as function_row

  union all
  select 70, 'MIGRATION STATE', 'Target components before execution',
    'REVIEW'::text, component_row.details
  from migration_components as component_row

  union all
  select 80, 'ROLES', 'Super Admin and status distributions',
    case when (role_row.details->>'active_super_admins')::integer >= 1 then 'PASS' else 'BLOCK' end,
    role_row.details
  from role_and_status_state as role_row

  union all
  select 90, 'HIERARCHY', 'Broken links and cycles',
    case when (health_row.details->>'missing_leader_links')::integer = 0
      and (health_row.details->>'self_leader_links')::integer = 0
      and (health_row.details->>'broken_profile_member_links')::integer = 0
      and (health_row.details->>'duplicate_profile_member_links')::integer = 0
      and (health_row.details->>'cycle_roots')::integer = 0
      then 'PASS' else 'BLOCK' end,
    health_row.details
  from hierarchy_health as health_row

  union all
  select 100, 'STORAGE', 'Existing-session media access assumptions',
    case when storage_row.details->>'storage_objects_exists' = 'true'
      and storage_row.details->>'storage_objects_rls' = 'true'
      and storage_row.details->>'project_media_bucket_exists' = 'true'
      and storage_row.details->>'project_media_public' = 'false'
      then 'PASS' else 'BLOCK' end,
    storage_row.details
  from storage_state as storage_row
)
select section, check_name, result_status, details
from report
order by sort_order;
