create table if not exists public.falcon_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  match_radius_meters numeric(10,2) not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint falcon_locations_name_not_blank
    check (length(btrim(name)) > 0),
  constraint falcon_locations_latitude_check
    check (latitude >= -90 and latitude <= 90),
  constraint falcon_locations_longitude_check
    check (longitude >= -180 and longitude <= 180),
  constraint falcon_locations_match_radius_check
    check (match_radius_meters >= 0)
);

alter table public.falcon_locations enable row level security;

create index if not exists falcon_locations_active_name_idx
  on public.falcon_locations(name)
  where is_active = true;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  attendance_date date not null,
  checked_in_at timestamptz not null default now(),
  check_in_latitude numeric(9,6) not null,
  check_in_longitude numeric(9,6) not null,
  check_in_accuracy_meters numeric(10,2) not null,
  check_in_location_name text not null,
  check_in_location_source text not null,
  check_in_falcon_location_id uuid null references public.falcon_locations(id) on delete set null,
  current_latitude numeric(9,6) not null,
  current_longitude numeric(9,6) not null,
  current_accuracy_meters numeric(10,2) not null,
  current_location_name text not null,
  current_location_source text not null,
  current_falcon_location_id uuid null references public.falcon_locations(id) on delete set null,
  location_updated_at timestamptz not null default now(),
  checked_out_at timestamptz null,
  check_out_latitude numeric(9,6) null,
  check_out_longitude numeric(9,6) null,
  check_out_accuracy_meters numeric(10,2) null,
  check_out_location_name text null,
  check_out_location_source text null,
  check_out_falcon_location_id uuid null references public.falcon_locations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint attendance_sessions_member_date_unique
    unique (member_id, attendance_date),
  constraint attendance_sessions_check_in_latitude_check
    check (check_in_latitude >= -90 and check_in_latitude <= 90),
  constraint attendance_sessions_check_in_longitude_check
    check (check_in_longitude >= -180 and check_in_longitude <= 180),
  constraint attendance_sessions_check_in_accuracy_check
    check (check_in_accuracy_meters >= 0),
  constraint attendance_sessions_current_latitude_check
    check (current_latitude >= -90 and current_latitude <= 90),
  constraint attendance_sessions_current_longitude_check
    check (current_longitude >= -180 and current_longitude <= 180),
  constraint attendance_sessions_current_accuracy_check
    check (current_accuracy_meters >= 0),
  constraint attendance_sessions_check_out_latitude_check
    check (check_out_latitude is null or (check_out_latitude >= -90 and check_out_latitude <= 90)),
  constraint attendance_sessions_check_out_longitude_check
    check (check_out_longitude is null or (check_out_longitude >= -180 and check_out_longitude <= 180)),
  constraint attendance_sessions_check_out_accuracy_check
    check (check_out_accuracy_meters is null or check_out_accuracy_meters >= 0),
  constraint attendance_sessions_check_in_location_source_check
    check (check_in_location_source in ('falcon_location', 'reverse_geocoded', 'coordinates')),
  constraint attendance_sessions_current_location_source_check
    check (current_location_source in ('falcon_location', 'reverse_geocoded', 'coordinates')),
  constraint attendance_sessions_check_out_location_source_check
    check (check_out_location_source is null or check_out_location_source in ('falcon_location', 'reverse_geocoded', 'coordinates')),
  constraint attendance_sessions_checkout_location_complete_check
    check (
      checked_out_at is null
      or (
        check_out_latitude is not null
        and check_out_longitude is not null
        and check_out_accuracy_meters is not null
        and check_out_location_name is not null
        and check_out_location_source is not null
      )
    )
);

alter table public.attendance_sessions enable row level security;

create index if not exists attendance_sessions_member_date_idx
  on public.attendance_sessions(member_id, attendance_date desc);

create index if not exists attendance_sessions_today_presence_idx
  on public.attendance_sessions(attendance_date, checked_out_at, location_updated_at desc);

create index if not exists attendance_sessions_current_falcon_location_idx
  on public.attendance_sessions(current_falcon_location_id)
  where current_falcon_location_id is not null;

drop trigger if exists set_falcon_locations_updated_at
  on public.falcon_locations;
create trigger set_falcon_locations_updated_at
before update on public.falcon_locations
for each row execute function public.set_project_knowledge_updated_at();

drop trigger if exists set_attendance_sessions_updated_at
  on public.attendance_sessions;
create trigger set_attendance_sessions_updated_at
before update on public.attendance_sessions
for each row execute function public.set_project_knowledge_updated_at();
