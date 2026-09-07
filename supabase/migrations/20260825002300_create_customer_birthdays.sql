create table if not exists public.customer_birthdays (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  project text null,
  unit text null,
  birthday date not null,
  remarks text null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_birthdays_customer_name_check
    check (length(btrim(customer_name)) > 0 and char_length(customer_name) <= 120),
  constraint customer_birthdays_project_check
    check (project is null or char_length(project) <= 160),
  constraint customer_birthdays_unit_check
    check (unit is null or char_length(unit) <= 80),
  constraint customer_birthdays_remarks_check
    check (remarks is null or char_length(remarks) <= 1000),
  constraint customer_birthdays_soft_delete_check
    check (
      (is_deleted = false and deleted_at is null)
      or (is_deleted = true and deleted_at is not null)
    )
);

alter table public.customer_birthdays enable row level security;

create index if not exists customer_birthdays_owner_user_id_idx
  on public.customer_birthdays(owner_user_id);

create index if not exists customer_birthdays_birthday_idx
  on public.customer_birthdays(birthday);

create index if not exists customer_birthdays_owner_active_idx
  on public.customer_birthdays(owner_user_id, is_deleted);

create index if not exists customer_birthdays_owner_birthday_idx
  on public.customer_birthdays(owner_user_id, birthday)
  where is_deleted = false;

create trigger customer_birthdays_set_updated_at
before update on public.customer_birthdays
for each row execute function public.set_project_knowledge_updated_at();
