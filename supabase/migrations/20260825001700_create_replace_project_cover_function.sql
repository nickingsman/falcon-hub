create or replace function public.replace_project_cover_media(
  p_project_id uuid,
  p_media_id uuid,
  p_title text,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_description text default null
)
returns table (
  id uuid,
  project_id uuid,
  title text,
  media_type text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  description text,
  visibility text,
  sort_order integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  old_storage_paths text[]
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_old_storage_paths text[];
  v_new_media public.project_media%rowtype;
begin
  if p_title is null or pg_catalog.btrim(p_title) = '' then
    raise exception 'Title is required';
  end if;

  if p_storage_bucket is null or pg_catalog.btrim(p_storage_bucket) = '' then
    raise exception 'Storage bucket is required';
  end if;

  if p_storage_path is null or pg_catalog.btrim(p_storage_path) = '' then
    raise exception 'Storage path is required';
  end if;

  if p_file_size_bytes is not null and p_file_size_bytes < 0 then
    raise exception 'File size must be non-negative';
  end if;

  perform 1
  from public.projects as project
  where project.id = p_project_id
    and project.is_deleted = false
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  select coalesce(
    pg_catalog.array_agg(media.storage_path order by media.created_at),
    array[]::text[]
  )
    into v_old_storage_paths
  from public.project_media as media
  where media.project_id = p_project_id
    and media.media_type = 'project_cover'
    and media.is_deleted = false;

  update public.project_media as media
  set
    is_deleted = true,
    deleted_at = pg_catalog.now()
  where media.project_id = p_project_id
    and media.media_type = 'project_cover'
    and media.is_deleted = false;

  insert into public.project_media (
    id,
    project_id,
    title,
    media_type,
    storage_bucket,
    storage_path,
    mime_type,
    file_size_bytes,
    description,
    visibility,
    sort_order,
    is_deleted
  )
  values (
    p_media_id,
    p_project_id,
    pg_catalog.btrim(p_title),
    'project_cover',
    pg_catalog.btrim(p_storage_bucket),
    pg_catalog.btrim(p_storage_path),
    p_mime_type,
    p_file_size_bytes,
    p_description,
    'customer',
    0,
    false
  )
  returning * into v_new_media;

  return query
  select
    v_new_media.id,
    v_new_media.project_id,
    v_new_media.title,
    v_new_media.media_type,
    v_new_media.storage_bucket,
    v_new_media.storage_path,
    v_new_media.mime_type,
    v_new_media.file_size_bytes,
    v_new_media.description,
    v_new_media.visibility,
    v_new_media.sort_order,
    v_new_media.created_at,
    v_new_media.updated_at,
    v_old_storage_paths;
end;
$$;

revoke all on function public.replace_project_cover_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text
) from public;

revoke all on function public.replace_project_cover_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text
) from anon;

revoke all on function public.replace_project_cover_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text
) from authenticated;

grant execute on function public.replace_project_cover_media(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text
) to service_role;
