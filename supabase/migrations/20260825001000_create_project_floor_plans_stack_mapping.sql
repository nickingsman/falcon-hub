create table if not exists public.project_floor_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  tower_code text,
  media_id uuid not null references public.project_media(id) on delete restrict,
  floor_from integer not null,
  floor_to integer not null,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_floor_plans_floor_range_check
    check (floor_from > 0 and floor_to > 0 and floor_from <= floor_to)
);

alter table public.project_floor_plans enable row level security;

create index if not exists project_floor_plans_project_tower_floor_idx
  on public.project_floor_plans(project_id, lower(coalesce(tower_code, '')), floor_from, floor_to)
  where is_deleted = false;

create index if not exists project_floor_plans_project_sort_idx
  on public.project_floor_plans(project_id, sort_order, created_at)
  where is_deleted = false;

create table if not exists public.project_floor_plan_stacks (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.project_floor_plans(id) on delete cascade,
  stack_code text not null,
  unit_type_id uuid references public.project_unit_types(id) on delete set null,
  x_percent numeric(6,3) not null,
  y_percent numeric(6,3) not null,
  width_percent numeric(6,3) not null,
  height_percent numeric(6,3) not null,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_floor_plan_stacks_stack_code_not_blank_check
    check (btrim(stack_code) <> ''),
  constraint project_floor_plan_stacks_x_percent_check
    check (x_percent >= 0 and x_percent <= 100),
  constraint project_floor_plan_stacks_y_percent_check
    check (y_percent >= 0 and y_percent <= 100),
  constraint project_floor_plan_stacks_width_percent_check
    check (width_percent > 0 and width_percent <= 100),
  constraint project_floor_plan_stacks_height_percent_check
    check (height_percent > 0 and height_percent <= 100),
  constraint project_floor_plan_stacks_width_bounds_check
    check (x_percent + width_percent <= 100),
  constraint project_floor_plan_stacks_height_bounds_check
    check (y_percent + height_percent <= 100)
);

alter table public.project_floor_plan_stacks enable row level security;

create unique index if not exists project_floor_plan_stacks_active_code_unique_idx
  on public.project_floor_plan_stacks(floor_plan_id, btrim(stack_code))
  where is_deleted = false;

create index if not exists project_floor_plan_stacks_floor_plan_sort_idx
  on public.project_floor_plan_stacks(floor_plan_id, sort_order, created_at)
  where is_deleted = false;

drop trigger if exists set_project_floor_plans_updated_at on public.project_floor_plans;
create trigger set_project_floor_plans_updated_at
before update on public.project_floor_plans
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_floor_plan_stacks_updated_at on public.project_floor_plan_stacks;
create trigger set_project_floor_plan_stacks_updated_at
before update on public.project_floor_plan_stacks
for each row execute function public.set_project_knowledge_updated_at();
