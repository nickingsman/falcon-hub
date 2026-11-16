begin;

-- Complete the separately stored Property Map metadata without changing the
-- source Projects records. Existing columns and verified metadata are kept.
alter table public.project_map_locations
  add column if not exists construction_status text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

-- A legacy environment with saved coordinates but no verification metadata
-- needs an explicit owner-reviewed backfill. Never invent a status or audit
-- timestamp merely to make the migration pass.
do $$
begin
  if exists (
    select 1
    from public.project_map_locations
    where construction_status is null
       or confirmed_at is null
  ) then
    raise exception using
      errcode = '23502',
      message = 'Existing Property Map rows require reviewed construction status and confirmation metadata before this migration can continue';
  end if;
end
$$;

alter table public.project_map_locations
  alter column construction_status set not null,
  alter column confirmed_at set default now(),
  alter column confirmed_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_map_locations'::regclass
      and conname = 'project_map_locations_construction_status_check'
  ) then
    alter table public.project_map_locations
      add constraint project_map_locations_construction_status_check
      check (construction_status in ('under_construction', 'completed'));
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_map_locations'::regclass
      and conname = 'project_map_locations_latitude_range_check'
  ) then
    alter table public.project_map_locations
      add constraint project_map_locations_latitude_range_check
      check (latitude between -90 and 90);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_map_locations'::regclass
      and conname = 'project_map_locations_longitude_range_check'
  ) then
    alter table public.project_map_locations
      add constraint project_map_locations_longitude_range_check
      check (longitude between -180 and 180);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    join pg_catalog.pg_attribute attribute_record
      on attribute_record.attrelid = constraint_record.conrelid
     and attribute_record.attnum = any(constraint_record.conkey)
    where constraint_record.conrelid = 'public.project_map_locations'::regclass
      and constraint_record.confrelid = 'auth.users'::regclass
      and constraint_record.contype = 'f'
      and attribute_record.attname = 'confirmed_by'
  ) then
    alter table public.project_map_locations
      add constraint project_map_locations_confirmed_by_fkey
      foreign key (confirmed_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    join pg_catalog.pg_attribute attribute_record
      on attribute_record.attrelid = constraint_record.conrelid
     and attribute_record.attnum = any(constraint_record.conkey)
    where constraint_record.conrelid = 'public.project_map_locations'::regclass
      and constraint_record.confrelid = 'auth.users'::regclass
      and constraint_record.contype = 'f'
      and attribute_record.attname = 'updated_by'
  ) then
    alter table public.project_map_locations
      add constraint project_map_locations_updated_by_fkey
      foreign key (updated_by) references auth.users(id) on delete set null;
  end if;
end
$$;

alter table public.project_map_locations enable row level security;

-- Browser clients use authenticated Next.js routes and never access this table
-- directly. The server-side service role remains the sole data-access role.
revoke all on table public.project_map_locations from public, anon, authenticated;
grant select, insert, update, delete on table public.project_map_locations to service_role;

commit;
