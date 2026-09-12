create table if not exists public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_todos_title_check
    check (char_length(btrim(title)) between 1 and 200),
  constraint personal_todos_completion_check
    check (is_completed = (completed_at is not null))
);

alter table public.personal_todos enable row level security;

create index if not exists personal_todos_member_incomplete_created_idx
  on public.personal_todos(member_id, created_at desc)
  where is_completed = false;

create index if not exists personal_todos_member_completed_at_idx
  on public.personal_todos(member_id, completed_at desc)
  where is_completed = true;

drop trigger if exists personal_todos_set_updated_at on public.personal_todos;
create trigger personal_todos_set_updated_at
before update on public.personal_todos
for each row execute function public.set_project_knowledge_updated_at();

revoke all on table public.personal_todos from anon, authenticated;

