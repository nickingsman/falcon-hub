create table if not exists public.daily_sales_index_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  activity_date date not null,
  answered_calls integer not null default 0,
  new_leads_contact integer not null default 0,
  blasting integer not null default 0,
  follow_up integer not null default 0,
  appointment_made integer not null default 0,
  turn_up_appt integer not null default 0,
  presented integer not null default 0,
  unit_closed integer not null default 0,
  unit_sold integer not null default 0,
  unit_converted integer not null default 0,
  social_media_posting integer not null default 0,
  recruitment integer not null default 0,
  sign_up integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint daily_sales_index_entries_member_date_unique
    unique (member_id, activity_date),
  constraint daily_sales_index_entries_answered_calls_check
    check (answered_calls >= 0),
  constraint daily_sales_index_entries_new_leads_contact_check
    check (new_leads_contact >= 0),
  constraint daily_sales_index_entries_blasting_check
    check (blasting >= 0),
  constraint daily_sales_index_entries_follow_up_check
    check (follow_up >= 0),
  constraint daily_sales_index_entries_appointment_made_check
    check (appointment_made >= 0),
  constraint daily_sales_index_entries_turn_up_appt_check
    check (turn_up_appt >= 0),
  constraint daily_sales_index_entries_presented_check
    check (presented >= 0),
  constraint daily_sales_index_entries_unit_closed_check
    check (unit_closed >= 0),
  constraint daily_sales_index_entries_unit_sold_check
    check (unit_sold >= 0),
  constraint daily_sales_index_entries_unit_converted_check
    check (unit_converted >= 0),
  constraint daily_sales_index_entries_social_media_posting_check
    check (social_media_posting >= 0),
  constraint daily_sales_index_entries_recruitment_check
    check (recruitment >= 0),
  constraint daily_sales_index_entries_sign_up_check
    check (sign_up >= 0)
);

alter table public.daily_sales_index_entries enable row level security;

create index if not exists daily_sales_index_entries_member_date_idx
  on public.daily_sales_index_entries(member_id, activity_date desc);

create index if not exists daily_sales_index_entries_activity_date_member_idx
  on public.daily_sales_index_entries(activity_date desc, member_id);

create index if not exists daily_sales_index_entries_created_by_idx
  on public.daily_sales_index_entries(created_by, created_at desc)
  where created_by is not null;

create index if not exists daily_sales_index_entries_updated_by_idx
  on public.daily_sales_index_entries(updated_by, updated_at desc)
  where updated_by is not null;

drop trigger if exists set_daily_sales_index_entries_updated_at
  on public.daily_sales_index_entries;
create trigger set_daily_sales_index_entries_updated_at
before update on public.daily_sales_index_entries
for each row execute function public.set_project_knowledge_updated_at();
