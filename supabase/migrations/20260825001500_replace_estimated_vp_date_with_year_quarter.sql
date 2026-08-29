alter table public.projects
  add column if not exists estimated_vp_year integer,
  add column if not exists estimated_vp_quarter integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_estimated_vp_year_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_estimated_vp_year_check
      check (
        estimated_vp_year is null
        or (estimated_vp_year >= 1900 and estimated_vp_year <= 9999)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_estimated_vp_quarter_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_estimated_vp_quarter_check
      check (
        estimated_vp_quarter is null
        or estimated_vp_quarter between 1 and 4
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_estimated_vp_pair_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_estimated_vp_pair_check
      check (
        (estimated_vp_year is null and estimated_vp_quarter is null)
        or (estimated_vp_year is not null and estimated_vp_quarter is not null)
      );
  end if;
end $$;

alter table public.projects
  drop column if exists estimated_vp_date;
