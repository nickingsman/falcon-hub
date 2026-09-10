do $$
begin
  if exists (
    select 1
    from public.sales_cases
    where is_deleted = false and status <> 'cancelled'
    group by project_id, lower(btrim(unit_no))
    having count(*) > 1
  ) then
    raise exception 'Cannot enable active Sales unit protection: existing non-cancelled duplicate project/unit cases require review';
  end if;
end
$$;

create unique index if not exists sales_cases_active_project_unit_unique_idx
  on public.sales_cases(project_id, lower(btrim(unit_no)))
  where is_deleted = false and status <> 'cancelled';
