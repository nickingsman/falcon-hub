alter table public.project_unit_types
  add column if not exists spa_price_from numeric(14,2),
  add column if not exists spa_price_to numeric(14,2);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_spa_price_from_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_spa_price_from_check
      check (spa_price_from is null or spa_price_from >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_spa_price_to_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_spa_price_to_check
      check (spa_price_to is null or spa_price_to >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_spa_price_range_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_spa_price_range_check
      check (spa_price_from is null or spa_price_to is null or spa_price_to >= spa_price_from);
  end if;
end;
$$;
