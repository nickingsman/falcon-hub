create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  status text not null default 'draft',
  sort_order integer not null default 0,
  cover_image_url text null,
  published_at timestamptz null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint academy_courses_title_check check (
    length(btrim(title)) > 0
    and length(btrim(title)) <= 160
  ),
  constraint academy_courses_description_check check (
    description is null
    or length(description) <= 1200
  ),
  constraint academy_courses_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint academy_courses_sort_order_check check (sort_order >= 0),
  constraint academy_courses_cover_image_url_check check (
    cover_image_url is null
    or (
      length(cover_image_url) <= 1000
      and cover_image_url ~ '^https://'
    )
  ),
  constraint academy_courses_deleted_at_check check (
    (is_deleted = false and deleted_at is null)
    or (is_deleted = true and deleted_at is not null)
  )
);

create index if not exists academy_courses_published_sort_idx
  on public.academy_courses (sort_order, created_at, id)
  where is_deleted = false and status = 'published';

create index if not exists academy_courses_status_sort_idx
  on public.academy_courses (status, sort_order, created_at, id)
  where is_deleted = false;

create trigger academy_courses_set_updated_at
  before update on public.academy_courses
  for each row
  execute function public.set_project_knowledge_updated_at();

alter table public.academy_courses enable row level security;

create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null,
  description text null,
  video_source_type text not null default 'external',
  external_video_url text null,
  duration_seconds integer null,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint academy_lessons_title_check check (
    length(btrim(title)) > 0
    and length(btrim(title)) <= 160
  ),
  constraint academy_lessons_description_check check (
    description is null
    or length(description) <= 1200
  ),
  constraint academy_lessons_video_source_type_check check (
    video_source_type in ('youtube', 'vimeo', 'google_drive', 'external')
  ),
  constraint academy_lessons_external_video_url_check check (
    external_video_url is null
    or (
      length(external_video_url) <= 1000
      and external_video_url ~ '^https://'
    )
  ),
  constraint academy_lessons_duration_seconds_check check (
    duration_seconds is null
    or duration_seconds > 0
  ),
  constraint academy_lessons_sort_order_check check (sort_order >= 0),
  constraint academy_lessons_deleted_at_check check (
    (is_deleted = false and deleted_at is null)
    or (is_deleted = true and deleted_at is not null)
  )
);

create index if not exists academy_lessons_course_sort_idx
  on public.academy_lessons (course_id, sort_order, created_at, id)
  where is_deleted = false;

create index if not exists academy_lessons_video_source_type_idx
  on public.academy_lessons (video_source_type)
  where is_deleted = false;

create trigger academy_lessons_set_updated_at
  before update on public.academy_lessons
  for each row
  execute function public.set_project_knowledge_updated_at();

alter table public.academy_lessons enable row level security;

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  last_position_seconds integer not null default 0,
  max_watched_seconds integer not null default 0,
  started_at timestamptz null,
  last_watched_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint academy_lesson_progress_member_lesson_unique unique (member_id, lesson_id),
  constraint academy_lesson_progress_last_position_check check (last_position_seconds >= 0),
  constraint academy_lesson_progress_max_watched_check check (max_watched_seconds >= 0)
);

create index if not exists academy_lesson_progress_member_idx
  on public.academy_lesson_progress (member_id, updated_at desc);

create index if not exists academy_lesson_progress_lesson_idx
  on public.academy_lesson_progress (lesson_id, updated_at desc);

create trigger academy_lesson_progress_set_updated_at
  before update on public.academy_lesson_progress
  for each row
  execute function public.set_project_knowledge_updated_at();

alter table public.academy_lesson_progress enable row level security;
