alter table public.project_media
drop constraint if exists project_media_type_check;

alter table public.project_media
add constraint project_media_type_check
  check (media_type in (
    'unit_layout',
    'floor_plan',
    'facing_view',
    'project_image',
    'project_cover',
    'other'
  ));

create unique index if not exists project_media_one_active_cover_per_project_idx
  on public.project_media(project_id)
  where media_type = 'project_cover'
    and is_deleted = false;
