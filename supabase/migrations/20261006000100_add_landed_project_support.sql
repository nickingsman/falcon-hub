alter table public.projects
  add column if not exists property_category text,
  add column if not exists ownership_title_type text,
  add column if not exists maintenance_fee_type text,
  add column if not exists maintenance_fee_fixed_monthly numeric(14,2),
  add column if not exists maintenance_calculation_basis text;

alter table public.project_unit_types
  add column if not exists land_size_sqft integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_property_category_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_property_category_check check (property_category is null or property_category in ('high_rise', 'landed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_ownership_title_type_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_ownership_title_type_check check (ownership_title_type is null or ownership_title_type in ('strata', 'individual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_maintenance_fee_type_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_maintenance_fee_type_check check (maintenance_fee_type is null or maintenance_fee_type in ('per_sqft', 'fixed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_maintenance_calculation_basis_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_maintenance_calculation_basis_check check (maintenance_calculation_basis is null or maintenance_calculation_basis in ('built_up', 'land_size'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_maintenance_fee_fixed_monthly_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_maintenance_fee_fixed_monthly_check check (maintenance_fee_fixed_monthly is null or maintenance_fee_fixed_monthly >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_maintenance_configuration_check' and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_maintenance_configuration_check check (
      maintenance_fee_type is null
      or (maintenance_fee_type = 'per_sqft' and maintenance_fee_per_sqft is not null and maintenance_calculation_basis is not null and maintenance_fee_fixed_monthly is null)
      or (maintenance_fee_type = 'fixed' and maintenance_fee_fixed_monthly is not null and maintenance_calculation_basis is null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'project_unit_types_land_size_check' and conrelid = 'public.project_unit_types'::regclass) then
    alter table public.project_unit_types add constraint project_unit_types_land_size_check check (land_size_sqft is null or land_size_sqft > 0);
  end if;
end;
$$;

update public.projects
set
  maintenance_fee_type = 'per_sqft',
  maintenance_calculation_basis = 'built_up'
where maintenance_fee_per_sqft is not null
  and maintenance_fee_type is null;
