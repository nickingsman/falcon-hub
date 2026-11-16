-- Apply only in a reviewed non-production environment first.
-- Project map coordinates are kept separate to avoid altering existing project records.
create table if not exists public.project_map_locations (
  project_id uuid primary key references public.projects(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.project_map_locations enable row level security;
-- Access is mediated by authenticated Next.js API routes; no direct client grants.
