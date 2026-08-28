create table if not exists public.project_facings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  media_id uuid references public.project_media(id) on delete set null,
  view_type text,
  disclaimer text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_facings_name_not_blank_check
    check (btrim(name) <> ''),
  constraint project_facings_view_type_check
    check (view_type is null or view_type in ('actual', 'indicative', 'artist_impression'))
);

alter table public.project_facings enable row level security;

create index if not exists project_facings_project_sort_idx
  on public.project_facings(project_id, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_facings_project_media_idx
  on public.project_facings(project_id, media_id)
  where is_deleted = false and media_id is not null;

alter table public.project_floor_plan_stacks
add column if not exists facing_id uuid references public.project_facings(id) on delete set null;

create index if not exists project_floor_plan_stacks_facing_idx
  on public.project_floor_plan_stacks(facing_id)
  where is_deleted = false and facing_id is not null;

create or replace function public.validate_project_floor_plan_stack_facing()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_floor_plan_project_id uuid;
  v_facing_project_id uuid;
begin
  if new.facing_id is null then
    return new;
  end if;

  select floor_plan.project_id
    into v_floor_plan_project_id
  from public.project_floor_plans as floor_plan
  where floor_plan.id = new.floor_plan_id
    and floor_plan.is_deleted = false;

  if v_floor_plan_project_id is null then
    raise exception 'Floor Plan not found for Stack Mapping';
  end if;

  select facing.project_id
    into v_facing_project_id
  from public.project_facings as facing
  where facing.id = new.facing_id
    and facing.is_deleted = false;

  if v_facing_project_id is null then
    raise exception 'Facing / View not found for Stack Mapping';
  end if;

  if v_floor_plan_project_id <> v_facing_project_id then
    raise exception 'Facing / View must belong to the same Project as the Floor Plan';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_project_floor_plan_stack_facing on public.project_floor_plan_stacks;
create trigger validate_project_floor_plan_stack_facing
before insert or update of floor_plan_id, facing_id on public.project_floor_plan_stacks
for each row execute function public.validate_project_floor_plan_stack_facing();

drop trigger if exists set_project_facings_updated_at on public.project_facings;
create trigger set_project_facings_updated_at
before update on public.project_facings
for each row execute function public.set_project_knowledge_updated_at();
