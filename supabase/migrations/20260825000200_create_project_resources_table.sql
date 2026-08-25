create table if not exists public.project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  resource_name text not null,
  resource_type text not null,
  description text,
  external_link text,
  visibility text not null default 'internal',
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.project_resources enable row level security;

create index if not exists project_resources_project_sort_created_idx
  on public.project_resources(project_id, sort_order, created_at)
  where is_deleted = false;

drop trigger if exists set_project_resources_updated_at on public.project_resources;
create trigger set_project_resources_updated_at
before update on public.project_resources
for each row execute function public.set_project_knowledge_updated_at();
