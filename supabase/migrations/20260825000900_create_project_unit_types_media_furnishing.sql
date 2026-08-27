insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-media',
  'project-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create table if not exists public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  media_type text not null,
  storage_bucket text not null default 'project-media',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  description text,
  visibility text not null default 'customer',
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_media_visibility_check
    check (visibility in ('customer', 'internal')),
  constraint project_media_type_check
    check (media_type in ('unit_layout', 'floor_plan', 'facing_view', 'project_image', 'other')),
  constraint project_media_file_size_check
    check (file_size_bytes is null or file_size_bytes >= 0)
);

alter table public.project_media enable row level security;

create index if not exists project_media_project_type_visibility_sort_idx
  on public.project_media(project_id, media_type, visibility, sort_order, created_at)
  where is_deleted = false;

create index if not exists project_media_project_sort_idx
  on public.project_media(project_id, sort_order, created_at)
  where is_deleted = false;

create unique index if not exists project_media_active_storage_path_unique_idx
  on public.project_media(storage_bucket, storage_path)
  where is_deleted = false;

create table if not exists public.project_furnishing_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  package_name text not null,
  description text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.project_furnishing_packages enable row level security;

create index if not exists project_furnishing_packages_project_sort_idx
  on public.project_furnishing_packages(project_id, sort_order, created_at)
  where is_deleted = false;

create table if not exists public.project_furnishing_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.project_furnishing_packages(id) on delete cascade,
  item_name text not null,
  quantity integer,
  description text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_furnishing_items_quantity_check
    check (quantity is null or quantity > 0)
);

alter table public.project_furnishing_items enable row level security;

create index if not exists project_furnishing_items_package_sort_idx
  on public.project_furnishing_items(package_id, sort_order, created_at)
  where is_deleted = false;

create table if not exists public.project_unit_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type_code text not null,
  type_name text,
  bedrooms integer,
  additional_rooms integer not null default 0,
  bathrooms integer,
  display_configuration text,
  size_sqft integer,
  default_carparks integer,
  carpark_description text,
  layout_media_id uuid references public.project_media(id) on delete set null,
  furnishing_package_id uuid references public.project_furnishing_packages(id) on delete set null,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_unit_types_size_check
    check (size_sqft is null or size_sqft > 0),
  constraint project_unit_types_bedrooms_check
    check (bedrooms is null or bedrooms >= 0),
  constraint project_unit_types_additional_rooms_check
    check (additional_rooms >= 0),
  constraint project_unit_types_bathrooms_check
    check (bathrooms is null or bathrooms >= 0),
  constraint project_unit_types_carparks_check
    check (default_carparks is null or default_carparks >= 0)
);

alter table public.project_unit_types enable row level security;

create index if not exists project_unit_types_project_sort_idx
  on public.project_unit_types(project_id, sort_order, created_at)
  where is_deleted = false;

create unique index if not exists project_unit_types_project_type_code_unique_idx
  on public.project_unit_types(project_id, lower(type_code))
  where is_deleted = false;

drop trigger if exists set_project_media_updated_at on public.project_media;
create trigger set_project_media_updated_at
before update on public.project_media
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_furnishing_packages_updated_at on public.project_furnishing_packages;
create trigger set_project_furnishing_packages_updated_at
before update on public.project_furnishing_packages
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_furnishing_items_updated_at on public.project_furnishing_items;
create trigger set_project_furnishing_items_updated_at
before update on public.project_furnishing_items
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_project_unit_types_updated_at on public.project_unit_types;
create trigger set_project_unit_types_updated_at
before update on public.project_unit_types
for each row execute function public.set_project_knowledge_updated_at();
