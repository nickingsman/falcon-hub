alter table public.projects
  add column if not exists estimated_vp_date date,
  add column if not exists maintenance_fee_per_sqft numeric(10,2);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'projects_maintenance_fee_per_sqft_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_maintenance_fee_per_sqft_check
      check (maintenance_fee_per_sqft is null or maintenance_fee_per_sqft >= 0);
  end if;
end;
$$;

alter table public.project_unit_types
  add column if not exists price_from numeric(14,2),
  add column if not exists price_to numeric(14,2),
  add column if not exists estimated_rental_from numeric(14,2),
  add column if not exists estimated_rental_to numeric(14,2),
  add column if not exists has_balcony boolean,
  add column if not exists is_dual_key boolean;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_price_from_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_price_from_check
      check (price_from is null or price_from >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_price_to_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_price_to_check
      check (price_to is null or price_to >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_price_range_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_price_range_check
      check (price_from is null or price_to is null or price_to >= price_from);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_estimated_rental_from_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_estimated_rental_from_check
      check (estimated_rental_from is null or estimated_rental_from >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_estimated_rental_to_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_estimated_rental_to_check
      check (estimated_rental_to is null or estimated_rental_to >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'project_unit_types_estimated_rental_range_check'
      and conrelid = 'public.project_unit_types'::regclass
  ) then
    alter table public.project_unit_types
      add constraint project_unit_types_estimated_rental_range_check
      check (
        estimated_rental_from is null
        or estimated_rental_to is null
        or estimated_rental_to >= estimated_rental_from
      );
  end if;
end;
$$;

create table if not exists public.project_connectivity_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null,
  name text not null,
  distance_meters integer,
  connection_mode text,
  customer_description text,
  internal_note text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_connectivity_points_category_check
    check (category in (
      'lrt',
      'mrt',
      'ktm',
      'monorail',
      'brt',
      'highway',
      'mall',
      'grocery',
      'school',
      'university',
      'hospital',
      'park',
      'business_district',
      'other'
    )),
  constraint project_connectivity_points_connection_mode_check
    check (
      connection_mode is null
      or connection_mode in (
        'walking',
        'direct_connected',
        'sheltered_walking',
        'shuttle',
        'driving',
        'nearby',
        'other'
      )
    ),
  constraint project_connectivity_points_name_not_blank_check
    check (btrim(name) <> ''),
  constraint project_connectivity_points_distance_meters_check
    check (distance_meters is null or distance_meters >= 0)
);

alter table public.project_connectivity_points enable row level security;

create index if not exists project_connectivity_points_project_category_sort_idx
  on public.project_connectivity_points(project_id, category, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_connectivity_points_project_distance_idx
  on public.project_connectivity_points(project_id, distance_meters)
  where is_deleted = false and distance_meters is not null;

create table if not exists public.project_commercial_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  package_name text not null,
  customer_description text,
  internal_note text,
  valid_from date,
  valid_until date,
  applies_to_all_unit_types boolean not null default true,
  furnishing_package_id uuid references public.project_furnishing_packages(id) on delete set null,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_commercial_packages_name_not_blank_check
    check (btrim(package_name) <> ''),
  constraint project_commercial_packages_valid_range_check
    check (valid_from is null or valid_until is null or valid_until >= valid_from)
);

alter table public.project_commercial_packages enable row level security;

create index if not exists project_commercial_packages_project_sort_idx
  on public.project_commercial_packages(project_id, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_commercial_packages_project_validity_idx
  on public.project_commercial_packages(project_id, valid_from, valid_until)
  where is_deleted = false;

create index if not exists project_commercial_packages_furnishing_package_idx
  on public.project_commercial_packages(furnishing_package_id)
  where is_deleted = false and furnishing_package_id is not null;

create table if not exists public.project_commercial_package_unit_types (
  package_id uuid not null references public.project_commercial_packages(id) on delete cascade,
  unit_type_id uuid not null references public.project_unit_types(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (package_id, unit_type_id)
);

alter table public.project_commercial_package_unit_types enable row level security;

create index if not exists project_commercial_package_unit_types_unit_type_idx
  on public.project_commercial_package_unit_types(unit_type_id);

create table if not exists public.project_commercial_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.project_commercial_packages(id) on delete cascade,
  item_type text not null,
  description text not null,
  discount_method text,
  value numeric(14,2),
  cash_benefit_treatment text,
  receive_at text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_commercial_package_items_type_check
    check (item_type in ('discount', 'cash_benefit', 'non_cash_benefit')),
  constraint project_commercial_package_items_description_not_blank_check
    check (btrim(description) <> ''),
  constraint project_commercial_package_items_discount_method_check
    check (
      discount_method is null
      or discount_method in ('percentage_spa', 'percentage_previous_balance', 'fixed')
    ),
  constraint project_commercial_package_items_cash_benefit_treatment_check
    check (
      cash_benefit_treatment is null
      or cash_benefit_treatment in ('immediate_offset', 'refund_later')
    ),
  constraint project_commercial_package_items_value_check
    check (value is null or value >= 0),
  constraint project_commercial_package_items_shape_check
    check (
      (
        item_type = 'discount'
        and discount_method is not null
        and value is not null
        and cash_benefit_treatment is null
        and receive_at is null
      )
      or (
        item_type = 'cash_benefit'
        and discount_method is null
        and value is not null
        and cash_benefit_treatment is not null
      )
      or (
        item_type = 'non_cash_benefit'
        and discount_method is null
        and value is null
        and cash_benefit_treatment is null
        and receive_at is null
      )
    )
);

alter table public.project_commercial_package_items enable row level security;

create index if not exists project_commercial_package_items_package_sort_idx
  on public.project_commercial_package_items(package_id, sort_order, created_at)
  where is_deleted = false;

create table if not exists public.project_commercial_package_purchase_costs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.project_commercial_packages(id) on delete cascade,
  cost_key text not null,
  treatment text not null,
  amount_override numeric(14,2),
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_commercial_package_purchase_costs_cost_key_check
    check (cost_key in (
      'spa_legal_fee',
      'loan_legal_fee',
      'spa_disbursement_fee',
      'loan_disbursement_fee',
      'loan_stamp_duty',
      'mot_transfer_stamp_duty',
      'valuation_fee'
    )),
  constraint project_commercial_package_purchase_costs_treatment_check
    check (treatment in ('customer_pay', 'developer_absorbed', 'not_applicable')),
  constraint project_commercial_package_purchase_costs_amount_override_check
    check (amount_override is null or amount_override >= 0),
  constraint project_commercial_package_purchase_costs_package_key_unique
    unique (package_id, cost_key)
);

alter table public.project_commercial_package_purchase_costs enable row level security;

create index if not exists project_commercial_package_purchase_costs_package_sort_idx
  on public.project_commercial_package_purchase_costs(package_id, sort_order, created_at);

create or replace function public.validate_project_commercial_package_furnishing_project()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_furnishing_project_id uuid;
begin
  if new.furnishing_package_id is null then
    return new;
  end if;

  select furnishing.project_id
    into v_furnishing_project_id
  from public.project_furnishing_packages as furnishing
  where furnishing.id = new.furnishing_package_id
    and furnishing.is_deleted = false;

  if v_furnishing_project_id is null then
    raise exception 'Furnishing Package not found for Commercial Package';
  end if;

  if v_furnishing_project_id <> new.project_id then
    raise exception 'Furnishing Package must belong to the same Project as the Commercial Package';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_project_commercial_package_furnishing_project
  on public.project_commercial_packages;
create trigger validate_project_commercial_package_furnishing_project
before insert or update of project_id, furnishing_package_id on public.project_commercial_packages
for each row execute function public.validate_project_commercial_package_furnishing_project();

create or replace function public.validate_project_commercial_package_unit_type_project()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_package_project_id uuid;
  v_unit_type_project_id uuid;
begin
  select commercial_package.project_id
    into v_package_project_id
  from public.project_commercial_packages as commercial_package
  where commercial_package.id = new.package_id
    and commercial_package.is_deleted = false;

  if v_package_project_id is null then
    raise exception 'Commercial Package not found for Unit Type mapping';
  end if;

  select unit_type.project_id
    into v_unit_type_project_id
  from public.project_unit_types as unit_type
  where unit_type.id = new.unit_type_id
    and unit_type.is_deleted = false;

  if v_unit_type_project_id is null then
    raise exception 'Unit Type not found for Commercial Package mapping';
  end if;

  if v_package_project_id <> v_unit_type_project_id then
    raise exception 'Commercial Package and Unit Type must belong to the same Project';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_project_commercial_package_unit_type_project
  on public.project_commercial_package_unit_types;
create trigger validate_project_commercial_package_unit_type_project
before insert or update of package_id, unit_type_id on public.project_commercial_package_unit_types
for each row execute function public.validate_project_commercial_package_unit_type_project();

drop trigger if exists set_project_connectivity_points_updated_at on public.project_connectivity_points;
create trigger set_project_connectivity_points_updated_at
before update on public.project_connectivity_points
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_commercial_packages_updated_at on public.project_commercial_packages;
create trigger set_project_commercial_packages_updated_at
before update on public.project_commercial_packages
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_commercial_package_items_updated_at on public.project_commercial_package_items;
create trigger set_project_commercial_package_items_updated_at
before update on public.project_commercial_package_items
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_commercial_package_purchase_costs_updated_at
  on public.project_commercial_package_purchase_costs;
create trigger set_project_commercial_package_purchase_costs_updated_at
before update on public.project_commercial_package_purchase_costs
for each row execute function public.set_project_knowledge_updated_at();
