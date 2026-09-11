alter table public.projects
  add column if not exists contact_role text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text;

alter table public.project_floor_plan_stacks
  add column if not exists shape_type text not null default 'rectangle',
  add column if not exists polygon_points jsonb;

alter table public.project_floor_plan_stacks
  drop constraint if exists project_floor_plan_stacks_shape_type_check;

alter table public.project_floor_plan_stacks
  add constraint project_floor_plan_stacks_shape_type_check
  check (shape_type in ('rectangle', 'polygon'));

alter table public.project_floor_plan_stacks
  drop constraint if exists project_floor_plan_stacks_polygon_points_check;

alter table public.project_floor_plan_stacks
  add constraint project_floor_plan_stacks_polygon_points_check
  check (
    (shape_type = 'rectangle' and polygon_points is null)
    or
    (
      shape_type = 'polygon'
      and jsonb_typeof(polygon_points) = 'array'
      and jsonb_array_length(polygon_points) >= 3
    )
  );
