alter table public.projects
add column if not exists unit_number_format text;

alter table public.projects
drop constraint if exists projects_unit_number_format_check;

alter table public.projects
add constraint projects_unit_number_format_check
  check (
    unit_number_format is null
    or unit_number_format in ('tower-floor-stack', 'floor-stack', 'manual')
  );
