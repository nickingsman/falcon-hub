alter table public.customer_birthdays
  alter column birthday drop not null,
  add column if not exists phone text null,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists project_id uuid null references public.projects(id) on delete set null;

alter table public.customer_birthdays
  add constraint customer_birthdays_phone_check
    check (phone is null or char_length(phone) <= 40),
  add constraint customer_birthdays_tags_count_check
    check (cardinality(tags) <= 20);

create index if not exists customer_birthdays_project_id_idx
  on public.customer_birthdays(project_id)
  where project_id is not null and is_deleted = false;

create index if not exists customer_birthdays_tags_idx
  on public.customer_birthdays using gin(tags)
  where is_deleted = false;
