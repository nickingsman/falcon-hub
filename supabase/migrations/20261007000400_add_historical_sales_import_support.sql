alter table public.sales_cases
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_project_name text null,
  add column if not exists source_row integer null,
  add column if not exists source_fingerprint text null;

alter table public.sales_cases
  alter column project_id drop not null;

alter table public.sales_cases
  drop constraint if exists sales_cases_source_type_check,
  add constraint sales_cases_source_type_check
    check (source_type in ('manual', 'historical_2026_case_report')),
  drop constraint if exists sales_cases_project_identity_check,
  add constraint sales_cases_project_identity_check check (
    (source_type = 'manual' and project_id is not null)
    or
    (source_type = 'historical_2026_case_report'
      and (project_id is not null or nullif(btrim(source_project_name), '') is not null)
      and source_row is not null and source_row > 0
      and nullif(btrim(source_fingerprint), '') is not null)
  ),
  drop constraint if exists sales_cases_spa_date_check,
  add constraint sales_cases_spa_date_check check (
    status <> 'sign_spa'
    or spa_signed_date is not null
    or source_type = 'historical_2026_case_report'
  ),
  drop constraint if exists sales_cases_cancel_date_check,
  add constraint sales_cases_cancel_date_check check (
    status <> 'cancelled'
    or cancel_date is not null
    or source_type = 'historical_2026_case_report'
  );

create unique index if not exists sales_cases_historical_source_fingerprint_unique_idx
  on public.sales_cases(source_fingerprint)
  where source_type = 'historical_2026_case_report' and is_deleted = false;

create unique index if not exists sales_cases_historical_unmapped_active_unit_unique_idx
  on public.sales_cases(lower(btrim(source_project_name)), lower(btrim(unit_no)))
  where source_type = 'historical_2026_case_report'
    and project_id is null
    and is_deleted = false
    and status <> 'cancelled';

alter table public.sales_case_contributors
  add column if not exists source_member_name text null;

alter table public.sales_case_contributors
  alter column member_id drop not null;

alter table public.sales_case_contributors
  drop constraint if exists sales_case_contributors_identity_check,
  add constraint sales_case_contributors_identity_check check (
    member_id is not null or nullif(btrim(source_member_name), '') is not null
  );

create unique index if not exists sales_case_contributors_unmapped_name_unique_idx
  on public.sales_case_contributors(sales_case_id, lower(btrim(source_member_name)))
  where member_id is null;

create or replace function public.import_historical_sales_case(
  p_project_id uuid,
  p_source_project_name text,
  p_source_row integer,
  p_source_fingerprint text,
  p_unit_no text,
  p_booking_date date,
  p_nett_price numeric,
  p_falcon_portion numeric,
  p_status text,
  p_remark text,
  p_contributors jsonb,
  p_actor uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_falcon_scaled bigint;
  v_contributor_scaled bigint;
begin
  if p_source_row is null or p_source_row <= 0 or nullif(btrim(p_source_fingerprint), '') is null then
    raise exception 'Historical source row and fingerprint are required';
  end if;
  if p_project_id is null and nullif(btrim(p_source_project_name), '') is null then
    raise exception 'A matched project or historical source project name is required';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and is_deleted = false
  ) then
    raise exception 'Historical project is not available';
  end if;
  if p_status not in ('booking', 'submitted', 'loan_approved', 'sign_spa', 'cancelled') then
    raise exception 'Historical Sales status is invalid';
  end if;
  if p_falcon_portion is null or p_falcon_portion <= 0 or p_falcon_portion > 100 or scale(p_falcon_portion) > 4 then
    raise exception 'Historical Falcon Portion is invalid';
  end if;
  if jsonb_typeof(p_contributors) <> 'array' or jsonb_array_length(p_contributors) = 0 then
    raise exception 'At least one historical contributor is required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_contributors) item
    where nullif(btrim(item->>'sourceName'), '') is null
      or item->>'portion' is null
      or (item->>'portion') !~ '^([0-9]+)(\.[0-9]{1,4})?$'
      or (item->>'portion')::numeric <= 0
      or (item->>'portion')::numeric > 100
      or (
        nullif(item->>'memberId', '') is not null
        and not exists (
          select 1 from public.users
          where id = (item->>'memberId')::uuid and is_deleted = false
        )
      )
  ) then
    raise exception 'Historical contributor data is invalid';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) <> (
    select count(distinct item->>'memberId')
    from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) then
    raise exception 'A matched historical member can only be selected once';
  end if;

  v_falcon_scaled := (p_falcon_portion * 10000)::bigint;
  select coalesce(sum(((item->>'portion')::numeric * 10000)::bigint), 0)
    into v_contributor_scaled
  from jsonb_array_elements(p_contributors) item;
  if v_contributor_scaled <> v_falcon_scaled then
    raise exception 'Historical contributor allocations must exactly equal Falcon Portion';
  end if;

  insert into public.sales_cases (
    project_id, source_type, source_project_name, source_row, source_fingerprint,
    unit_no, booking_date, nett_price, falcon_portion, status,
    spa_signed_date, cancel_date, remark, created_by, updated_by
  ) values (
    p_project_id, 'historical_2026_case_report', nullif(btrim(p_source_project_name), ''),
    p_source_row, btrim(p_source_fingerprint), btrim(p_unit_no), p_booking_date,
    p_nett_price, p_falcon_portion, p_status, null, null,
    nullif(btrim(p_remark), ''), p_actor, p_actor
  ) returning id into v_case_id;

  insert into public.sales_case_contributors (
    sales_case_id, member_id, source_member_name, portion
  )
  select
    v_case_id,
    nullif(item->>'memberId', '')::uuid,
    btrim(item->>'sourceName'),
    (item->>'portion')::numeric
  from jsonb_array_elements(p_contributors) item;

  insert into public.sales_case_status_history (
    sales_case_id, status, effective_date, created_by, note
  ) values (
    v_case_id, p_status,
    case when p_status in ('sign_spa', 'cancelled') then null else p_booking_date end,
    p_actor, 'Historical import; exact lifecycle date unavailable'
  );

  return v_case_id;
end;
$$;

revoke all on function public.import_historical_sales_case(uuid,text,integer,text,text,date,numeric,numeric,text,text,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.import_historical_sales_case(uuid,text,integer,text,text,date,numeric,numeric,text,text,jsonb,uuid)
  to service_role;
