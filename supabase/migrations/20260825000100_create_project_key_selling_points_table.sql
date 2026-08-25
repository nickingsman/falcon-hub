create table if not exists public.project_key_selling_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  short_explanation text,
  how_to_sell text,
  supporting_data text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.project_key_selling_points enable row level security;

create index if not exists project_key_selling_points_project_sort_created_idx
  on public.project_key_selling_points(project_id, sort_order, created_at)
  where is_deleted = false;

drop trigger if exists set_project_key_selling_points_updated_at on public.project_key_selling_points;
create trigger set_project_key_selling_points_updated_at
before update on public.project_key_selling_points
for each row execute function public.set_project_knowledge_updated_at();
