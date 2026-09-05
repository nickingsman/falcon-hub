create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  event_date date not null,
  is_all_day boolean not null default false,
  start_time time null,
  end_time time null,
  location text null,
  description text null,
  audience_type text not null,
  target_team_member_id uuid null references public.users(id) on delete restrict,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint calendar_events_title_not_blank
    check (length(btrim(title)) > 0),
  constraint calendar_events_category_check
    check (
      category in (
        'company_meeting',
        'team_meeting',
        'training',
        'roleplay',
        'recognition_event',
        'project_activity',
        'other'
      )
    ),
  constraint calendar_events_audience_type_check
    check (audience_type in ('company', 'team')),
  constraint calendar_events_audience_target_check
    check (
      (audience_type = 'company' and target_team_member_id is null)
      or (audience_type = 'team' and target_team_member_id is not null)
    ),
  constraint calendar_events_timed_start_check
    check (is_all_day = true or start_time is not null),
  constraint calendar_events_end_time_check
    check (start_time is null or end_time is null or end_time >= start_time),
  constraint calendar_events_deleted_at_check
    check (
      (is_deleted = false and deleted_at is null)
      or (is_deleted = true and deleted_at is not null)
    )
);

alter table public.calendar_events enable row level security;

create index if not exists calendar_events_active_date_idx
  on public.calendar_events(event_date, audience_type)
  where is_deleted = false;

create index if not exists calendar_events_target_team_date_idx
  on public.calendar_events(target_team_member_id, event_date)
  where is_deleted = false and target_team_member_id is not null;

create index if not exists calendar_events_created_by_idx
  on public.calendar_events(created_by, created_at desc)
  where created_by is not null;

create index if not exists calendar_events_updated_by_idx
  on public.calendar_events(updated_by, updated_at desc)
  where updated_by is not null;

drop trigger if exists set_calendar_events_updated_at
  on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_project_knowledge_updated_at();
