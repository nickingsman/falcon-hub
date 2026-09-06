create table if not exists public.saved_work (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  work_type text not null,
  schema_version integer not null default 1,
  payload jsonb not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_work_title_check
    check (length(btrim(title)) > 0 and length(btrim(title)) <= 120),
  constraint saved_work_type_check
    check (work_type in ('roi', 'project_comparison', 'progressive_interest')),
  constraint saved_work_schema_version_check
    check (schema_version >= 1),
  constraint saved_work_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint saved_work_deleted_at_check
    check (
      (is_deleted = false and deleted_at is null)
      or (is_deleted = true and deleted_at is not null)
    )
);

alter table public.saved_work enable row level security;

create index if not exists saved_work_owner_updated_idx
  on public.saved_work(owner_user_id, updated_at desc)
  where is_deleted = false;

create index if not exists saved_work_owner_type_updated_idx
  on public.saved_work(owner_user_id, work_type, updated_at desc)
  where is_deleted = false;

drop trigger if exists set_saved_work_updated_at
  on public.saved_work;
create trigger set_saved_work_updated_at
before update on public.saved_work
for each row execute function public.set_project_knowledge_updated_at();
