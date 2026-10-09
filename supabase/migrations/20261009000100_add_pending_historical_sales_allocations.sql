alter table public.sales_cases
  add column if not exists allocation_status text not null default 'verified',
  add column if not exists source_contributor_snapshot jsonb null;

alter table public.sales_cases
  drop constraint if exists sales_cases_allocation_status_check,
  add constraint sales_cases_allocation_status_check
    check (allocation_status in ('verified', 'pending')),
  drop constraint if exists sales_cases_source_type_check,
  add constraint sales_cases_source_type_check
    check (source_type in (
      'manual',
      'historical_2024_case_report',
      'historical_2025_case_report',
      'historical_2026_case_report'
    )),
  drop constraint if exists sales_cases_project_identity_check,
  add constraint sales_cases_project_identity_check check (
    (source_type = 'manual' and project_id is not null and allocation_status = 'verified')
    or
    (source_type like 'historical_%_case_report'
      and (project_id is not null or nullif(btrim(source_project_name), '') is not null)
      and source_row is not null and source_row > 0
      and nullif(btrim(source_fingerprint), '') is not null)
  );

drop index if exists sales_cases_historical_source_fingerprint_unique_idx;
create unique index if not exists sales_cases_historical_source_identity_unique_idx
  on public.sales_cases(source_type, source_fingerprint)
  where source_type like 'historical_%_case_report' and is_deleted = false;

drop index if exists sales_cases_historical_unmapped_active_unit_unique_idx;
create unique index if not exists sales_cases_historical_unmapped_active_unit_unique_idx
  on public.sales_cases(lower(btrim(source_project_name)), lower(btrim(unit_no)))
  where source_type like 'historical_%_case_report'
    and project_id is null
    and is_deleted = false
    and status <> 'cancelled';

alter table public.sales_case_contributors
  alter column portion drop not null;

alter table public.sales_case_contributors
  drop constraint if exists sales_case_contributors_portion_check,
  add constraint sales_case_contributors_portion_check
    check (portion is null or (portion > 0 and portion <= 100));

create or replace function public.import_historical_sales_case_v2(
  p_source_type text,
  p_project_id uuid,
  p_source_project_name text,
  p_source_row integer,
  p_source_fingerprint text,
  p_unit_no text,
  p_booking_date date,
  p_nett_price numeric,
  p_falcon_portion numeric,
  p_allocation_status text,
  p_remark text,
  p_source_contributor_snapshot jsonb,
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
  if p_source_type not in ('historical_2024_case_report', 'historical_2025_case_report') then
    raise exception 'Historical source type is invalid';
  end if;
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
  if p_booking_date is null
     or (p_source_type = 'historical_2024_case_report' and extract(year from p_booking_date)::integer <> 2024)
     or (p_source_type = 'historical_2025_case_report' and extract(year from p_booking_date)::integer <> 2025) then
    raise exception 'Historical Booking Date must match the source year';
  end if;
  if p_nett_price is null or p_nett_price <= 0 then
    raise exception 'Historical Nett Price must be greater than 0';
  end if;
  if p_falcon_portion is null or p_falcon_portion <= 0 or p_falcon_portion > 100 or scale(p_falcon_portion) > 4 then
    raise exception 'Historical Falcon Portion is invalid';
  end if;
  if p_allocation_status not in ('verified', 'pending') then
    raise exception 'Historical allocation status is invalid';
  end if;
  if jsonb_typeof(p_source_contributor_snapshot) <> 'array'
     or jsonb_array_length(p_source_contributor_snapshot) = 0 then
    raise exception 'Historical source contributor snapshot is required';
  end if;
  if jsonb_typeof(p_contributors) <> 'array' or jsonb_array_length(p_contributors) = 0 then
    raise exception 'At least one historical contributor is required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_contributors) item
    where nullif(btrim(item->>'sourceName'), '') is null
      or (
        nullif(item->>'memberId', '') is not null
        and not exists (
          select 1 from public.users
          where id = (item->>'memberId')::uuid and is_deleted = false
        )
      )
  ) then
    raise exception 'Historical contributor identity is invalid';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) <> (
    select count(distinct item->>'memberId') from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) then
    raise exception 'A matched historical member can only be selected once';
  end if;

  if p_allocation_status = 'verified' then
    if exists (
      select 1 from jsonb_array_elements(p_contributors) item
      where item->>'portion' is null
        or (item->>'portion') !~ '^([0-9]+)(\.[0-9]{1,4})?$'
        or (item->>'portion')::numeric <= 0
        or (item->>'portion')::numeric > 100
    ) then
      raise exception 'Verified historical contributor data is invalid';
    end if;
    v_falcon_scaled := (p_falcon_portion * 10000)::bigint;
    select coalesce(sum(((item->>'portion')::numeric * 10000)::bigint), 0)
      into v_contributor_scaled
    from jsonb_array_elements(p_contributors) item;
    if v_contributor_scaled <> v_falcon_scaled then
      raise exception 'Historical contributor allocations must exactly equal Falcon Portion';
    end if;
  elsif exists (
    select 1 from jsonb_array_elements(p_contributors) item
    where item->>'portion' is not null
  ) then
    raise exception 'Pending historical allocations must not store unverified portions';
  end if;

  insert into public.sales_cases (
    project_id, source_type, source_project_name, source_row, source_fingerprint,
    source_contributor_snapshot, allocation_status, unit_no, booking_date,
    nett_price, falcon_portion, status, spa_signed_date, cancel_date, remark,
    created_by, updated_by
  ) values (
    p_project_id, p_source_type, nullif(btrim(p_source_project_name), ''),
    p_source_row, btrim(p_source_fingerprint), p_source_contributor_snapshot,
    p_allocation_status, btrim(p_unit_no), p_booking_date, p_nett_price,
    p_falcon_portion, 'booking', null, null,
    nullif(btrim(p_remark), ''), p_actor, p_actor
  ) returning id into v_case_id;

  insert into public.sales_case_contributors (
    sales_case_id, member_id, source_member_name, portion
  )
  select
    v_case_id,
    nullif(item->>'memberId', '')::uuid,
    btrim(item->>'sourceName'),
    case when p_allocation_status = 'verified' then (item->>'portion')::numeric else null end
  from jsonb_array_elements(p_contributors) item;

  insert into public.sales_case_status_history (
    sales_case_id, status, effective_date, created_by, note
  ) values (
    v_case_id, 'booking', p_booking_date, p_actor,
    'Historical import; initial status normalized to Booking'
  );

  return v_case_id;
end;
$$;

revoke all on function public.import_historical_sales_case_v2(text,uuid,text,integer,text,text,date,numeric,numeric,text,text,jsonb,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.import_historical_sales_case_v2(text,uuid,text,integer,text,text,date,numeric,numeric,text,text,jsonb,jsonb,uuid)
  to service_role;

create or replace function public.verify_historical_sales_allocation(
  p_case_id uuid,
  p_contributors jsonb,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_falcon_portion numeric;
  v_falcon_scaled bigint;
  v_contributor_scaled bigint;
begin
  select falcon_portion into v_falcon_portion
  from public.sales_cases
  where id = p_case_id
    and not is_deleted
    and source_type in ('historical_2024_case_report', 'historical_2025_case_report')
    and allocation_status = 'pending'
  for update;
  if not found then raise exception 'Pending historical Sales case not found'; end if;

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
    select count(*) from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) <> (
    select count(distinct item->>'memberId') from jsonb_array_elements(p_contributors) item
    where nullif(item->>'memberId', '') is not null
  ) then
    raise exception 'A matched historical member can only be selected once';
  end if;

  v_falcon_scaled := (v_falcon_portion * 10000)::bigint;
  select coalesce(sum(((item->>'portion')::numeric * 10000)::bigint), 0)
    into v_contributor_scaled
  from jsonb_array_elements(p_contributors) item;
  if v_contributor_scaled <> v_falcon_scaled then
    raise exception 'Contributor allocations must exactly equal Falcon Portion';
  end if;

  delete from public.sales_case_contributors where sales_case_id = p_case_id;
  insert into public.sales_case_contributors (
    sales_case_id, member_id, source_member_name, portion
  )
  select
    p_case_id,
    nullif(item->>'memberId', '')::uuid,
    btrim(item->>'sourceName'),
    (item->>'portion')::numeric
  from jsonb_array_elements(p_contributors) item;

  update public.sales_cases
  set allocation_status = 'verified',
      remark = nullif(
        btrim(regexp_replace(coalesce(remark, ''), '(^|;?\s*)⚠️ Pending Allocation(;?\s*|$)', ' ', 'gi')),
        ''
      ),
      updated_by = p_actor
  where id = p_case_id;
end;
$$;

revoke all on function public.verify_historical_sales_allocation(uuid,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.verify_historical_sales_allocation(uuid,jsonb,uuid)
  to service_role;
