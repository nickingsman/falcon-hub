with
users_relation as (
  select
    table_row.oid,
    table_row.relowner,
    owner_role.rolname as owner_name,
    table_row.relrowsecurity,
    table_row.relforcerowsecurity,
    table_row.relacl::text as raw_acl
  from pg_catalog.pg_class as table_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = table_row.relowner
  where schema_row.nspname = 'public'
    and table_row.relname = 'users'
    and table_row.relkind in ('r', 'p')
),
inspected_roles(role_name) as (
  values ('anon'::text), ('authenticated'::text), ('service_role'::text)
),
role_properties as (
  select
    inspected.role_name,
    role_row.oid is not null as role_exists,
    coalesce(role_row.rolbypassrls, false) as bypasses_rls,
    coalesce(role_row.rolsuper, false) as is_superuser
  from inspected_roles as inspected
  left join pg_catalog.pg_roles as role_row on role_row.rolname = inspected.role_name
),
role_memberships as (
  select
    inspected.role_name,
    coalesce(
      pg_catalog.jsonb_agg(parent_role.rolname order by parent_role.rolname)
        filter (where parent_role.rolname is not null),
      '[]'::jsonb
    ) as inherited_roles
  from inspected_roles as inspected
  left join pg_catalog.pg_roles as member_role on member_role.rolname = inspected.role_name
  left join pg_catalog.pg_auth_members as membership on membership.member = member_role.oid
  left join pg_catalog.pg_roles as parent_role on parent_role.oid = membership.roleid
  group by inspected.role_name
),
effective_table_privileges as (
  select
    inspected.role_name,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'SELECT') as can_select,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'INSERT') as can_insert,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'UPDATE') as can_update,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'DELETE') as can_delete,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'TRUNCATE') as can_truncate,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'REFERENCES') as can_reference,
    pg_catalog.has_table_privilege(inspected.role_name, 'public.users', 'TRIGGER') as can_trigger
  from inspected_roles as inspected
),
effective_column_privileges as (
  select
    inspected.role_name,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      inspected.role_name, 'public.users', attribute_row.attname, 'SELECT'
    )), false) as any_select,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      inspected.role_name, 'public.users', attribute_row.attname, 'INSERT'
    )), false) as any_insert,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      inspected.role_name, 'public.users', attribute_row.attname, 'UPDATE'
    )), false) as any_update,
    coalesce(pg_catalog.bool_or(pg_catalog.has_column_privilege(
      inspected.role_name, 'public.users', attribute_row.attname, 'REFERENCES'
    )), false) as any_reference
  from inspected_roles as inspected
  cross join users_relation as users_table
  join pg_catalog.pg_attribute as attribute_row
    on attribute_row.attrelid = users_table.oid
   and attribute_row.attnum > 0
   and not attribute_row.attisdropped
  group by inspected.role_name
),
users_policies as (
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'name', policy_row.policyname,
        'command', policy_row.cmd,
        'roles', policy_row.roles,
        'using', policy_row.qual,
        'with_check', policy_row.with_check
      ) order by policy_row.policyname
    ),
    '[]'::jsonb
  ) as details
  from pg_catalog.pg_policies as policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'users'
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
    function_row.proowner = users_table.relowner as owner_matches_users
  from pg_catalog.pg_proc as function_row
  join pg_catalog.pg_namespace as schema_row on schema_row.oid = function_row.pronamespace
  join pg_catalog.pg_roles as owner_role on owner_role.oid = function_row.proowner
  cross join users_relation as users_table
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
),
function_inventory as (
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'signature', function_row.proname || '(' || function_row.identity_arguments || ')',
        'owner', function_row.owner_name,
        'security_definer', function_row.prosecdef,
        'owner_matches_users', function_row.owner_matches_users,
        'owner_bypasses_rls', function_row.owner_bypasses_rls,
        'configuration', function_row.proconfig,
        'anon_execute', pg_catalog.has_function_privilege('anon', function_row.oid, 'EXECUTE'),
        'authenticated_execute', pg_catalog.has_function_privilege('authenticated', function_row.oid, 'EXECUTE'),
        'service_role_execute', pg_catalog.has_function_privilege('service_role', function_row.oid, 'EXECUTE')
      ) order by function_row.proname, function_row.identity_arguments
    ),
    '[]'::jsonb
  ) as details
  from relevant_functions as function_row
),
function_compatibility as (
  select pg_catalog.count(*)::integer as incompatible_count
  from relevant_functions as function_row
  where not function_row.prosecdef
    or (
      not function_row.owner_matches_users
      and not function_row.owner_bypasses_rls
    )
),
sequence_inventory as (
  select pg_catalog.jsonb_build_object(
    'exists', pg_catalog.to_regclass('public.users_member_code_seq') is not null,
    'anon_usage', case when pg_catalog.to_regclass('public.users_member_code_seq') is null then null
      else pg_catalog.has_sequence_privilege('anon', 'public.users_member_code_seq', 'USAGE') end,
    'anon_select', case when pg_catalog.to_regclass('public.users_member_code_seq') is null then null
      else pg_catalog.has_sequence_privilege('anon', 'public.users_member_code_seq', 'SELECT') end,
    'authenticated_usage', case when pg_catalog.to_regclass('public.users_member_code_seq') is null then null
      else pg_catalog.has_sequence_privilege('authenticated', 'public.users_member_code_seq', 'USAGE') end,
    'authenticated_select', case when pg_catalog.to_regclass('public.users_member_code_seq') is null then null
      else pg_catalog.has_sequence_privilege('authenticated', 'public.users_member_code_seq', 'SELECT') end,
    'service_role_usage', case when pg_catalog.to_regclass('public.users_member_code_seq') is null then null
      else pg_catalog.has_sequence_privilege('service_role', 'public.users_member_code_seq', 'USAGE') end
  ) as details
),
data_baseline as (
  select pg_catalog.jsonb_build_object(
    'sales_count', (select pg_catalog.count(*) from public.sales_cases),
    'sales_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(sales_row)::text, '|' order by sales_row.id::text), ''
    )) from public.sales_cases as sales_row),
    'contributor_count', (select pg_catalog.count(*) from public.sales_case_contributors),
    'contributor_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(contributor_row)::text, '|' order by contributor_row.id::text), ''
    )) from public.sales_case_contributors as contributor_row),
    'users_count', (select pg_catalog.count(*) from public.users),
    'users_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(member_row)::text, '|' order by member_row.id::text), ''
    )) from public.users as member_row),
    'profiles_count', (select pg_catalog.count(*) from public.user_profiles),
    'profiles_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(profile_row)::text, '|' order by profile_row.auth_user_id::text), ''
    )) from public.user_profiles as profile_row),
    'leader_relationships', (select pg_catalog.count(*) from public.users where leader_id is not null),
    'hierarchy_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(
        member_row.id::text || ':' || coalesce(member_row.leader_id::text, '') || ':' ||
        coalesce(member_row.status, '') || ':' || coalesce(member_row.is_deleted::text, ''),
        '|' order by member_row.id::text
      ), ''
    )) from public.users as member_row),
    'audit_count', (select pg_catalog.count(*) from public.admin_user_audit_logs),
    'audit_hash', (select pg_catalog.md5(coalesce(
      pg_catalog.string_agg(pg_catalog.to_jsonb(audit_row)::text, '|' order by audit_row.id::text), ''
    )) from public.admin_user_audit_logs as audit_row)
  ) as details
),
storage_objects as (
  select pg_catalog.jsonb_build_object(
    'exists', storage_table.oid is not null,
    'rls_enabled', storage_table.relrowsecurity,
    'force_rls', storage_table.relforcerowsecurity,
    'policies', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', policy_row.policyname,
          'command', policy_row.cmd,
          'roles', policy_row.roles,
          'using', policy_row.qual,
          'with_check', policy_row.with_check
        ) order by policy_row.policyname
      ), '[]'::jsonb)
      from pg_catalog.pg_policies as policy_row
      where policy_row.schemaname = 'storage'
        and policy_row.tablename = 'objects'
    )
  ) as details
  from (select pg_catalog.to_regclass('storage.objects') as oid) as resolved
  left join pg_catalog.pg_class as storage_table on storage_table.oid = resolved.oid
),
project_media_bucket as (
  select coalesce(
    (
      select pg_catalog.jsonb_build_object(
        'exists', true,
        'public', bucket_row.public,
        'file_size_limit', bucket_row.file_size_limit,
        'allowed_mime_types', bucket_row.allowed_mime_types
      )
      from storage.buckets as bucket_row
      where bucket_row.id = 'project-media'
    ),
    pg_catalog.jsonb_build_object('exists', false)
  ) as details
),
hardening_status as (
  select
    users_table.relrowsecurity
      and not users_table.relforcerowsecurity
      and policy_row.details = '[]'::jsonb
      and compatibility_row.incompatible_count = 0
      and not exists (
        select 1 from effective_table_privileges as privilege_row
        where privilege_row.role_name in ('anon', 'authenticated')
          and (
            privilege_row.can_select or privilege_row.can_insert or privilege_row.can_update
            or privilege_row.can_delete or privilege_row.can_truncate
            or privilege_row.can_reference or privilege_row.can_trigger
          )
      )
      and not exists (
        select 1 from effective_column_privileges as privilege_row
        where privilege_row.role_name in ('anon', 'authenticated')
          and (
            privilege_row.any_select or privilege_row.any_insert
            or privilege_row.any_update or privilege_row.any_reference
          )
      )
      and exists (
        select 1 from effective_table_privileges as privilege_row
        where privilege_row.role_name = 'service_role'
          and privilege_row.can_select
          and privilege_row.can_insert
          and privilege_row.can_update
          and privilege_row.can_delete
      ) as passes
  from users_relation as users_table
  cross join users_policies as policy_row
  cross join function_compatibility as compatibility_row
),
report as (
  select 10 as sort_order, 'RESULT'::text as section,
    'public.users hardening'::text as check_name,
    case when status_row.passes then 'PASS' else 'FAIL' end as result_status,
    pg_catalog.jsonb_build_object('passes', status_row.passes) as details
  from hardening_status as status_row

  union all
  select 20, 'DATA RECONCILIATION', 'Compare exactly with saved pre-migration snapshot',
    'MANUAL COMPARE', baseline.details
  from data_baseline as baseline

  union all
  select 30, 'TABLE', 'Owner, ACL and RLS state',
    case when users_table.relrowsecurity and not users_table.relforcerowsecurity then 'PASS' else 'FAIL' end,
    pg_catalog.to_jsonb(users_table)
  from users_relation as users_table

  union all
  select 40, 'ROLES', 'Role properties and inherited roles',
    case when pg_catalog.bool_and(role_row.role_exists) then 'PASS' else 'FAIL' end,
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'role', role_row.role_name,
        'exists', role_row.role_exists,
        'bypasses_rls', role_row.bypasses_rls,
        'is_superuser', role_row.is_superuser,
        'inherits', membership_row.inherited_roles
      ) order by role_row.role_name
    )
  from role_properties as role_row
  join role_memberships as membership_row using (role_name)

  union all
  select 50, 'PRIVILEGES', 'Effective table privileges',
    case when not exists (
      select 1 from effective_table_privileges as blocked
      where blocked.role_name in ('anon', 'authenticated')
        and (blocked.can_select or blocked.can_insert or blocked.can_update or blocked.can_delete)
    ) then 'PASS' else 'FAIL' end,
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(privilege_row) order by privilege_row.role_name)
  from effective_table_privileges as privilege_row

  union all
  select 60, 'PRIVILEGES', 'Effective column privileges',
    case when not exists (
      select 1 from effective_column_privileges as blocked
      where blocked.role_name in ('anon', 'authenticated')
        and (blocked.any_select or blocked.any_insert or blocked.any_update or blocked.any_reference)
    ) then 'PASS' else 'FAIL' end,
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(privilege_row) order by privilege_row.role_name)
  from effective_column_privileges as privilege_row

  union all
  select 70, 'RLS', 'Default-deny policy state',
    case when policy_row.details = '[]'::jsonb then 'PASS' else 'FAIL' end,
    policy_row.details
  from users_policies as policy_row

  union all
  select 80, 'FUNCTIONS', 'Relevant RPC and trigger-function ownership',
    case when compatibility_row.incompatible_count = 0 then 'PASS' else 'FAIL' end,
    pg_catalog.jsonb_build_object(
      'incompatible_security_definer_owners', compatibility_row.incompatible_count,
      'functions', inventory_row.details
    )
  from function_compatibility as compatibility_row
  cross join function_inventory as inventory_row

  union all
  select 90, 'SEQUENCE', 'Member-code sequence privileges', 'REVIEW', sequence_row.details
  from sequence_inventory as sequence_row

  union all
  select 100, 'STORAGE', 'storage_objects RLS and policies', 'REVIEW', storage_row.details
  from storage_objects as storage_row

  union all
  select 110, 'STORAGE', 'project-media bucket',
    case when bucket_row.details->>'exists' = 'true' and bucket_row.details->>'public' = 'false'
      then 'PASS' else 'REVIEW' end,
    bucket_row.details
  from project_media_bucket as bucket_row
)
select section, check_name, result_status, details
from report
order by sort_order;
