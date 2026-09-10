create table if not exists public.sales_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  unit_no text not null,
  booking_date date not null,
  nett_price numeric(15,2) not null,
  falcon_portion numeric(7,4) not null,
  status text not null default 'booking',
  spa_signed_date date null,
  cancel_date date null,
  remark text null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint sales_cases_unit_no_check check (length(btrim(unit_no)) between 1 and 80),
  constraint sales_cases_nett_price_check check (nett_price > 0),
  constraint sales_cases_falcon_portion_check check (falcon_portion > 0 and falcon_portion <= 100),
  constraint sales_cases_status_check check (status in ('booking', 'submitted', 'loan_approved', 'sign_spa', 'cancelled')),
  constraint sales_cases_spa_date_check check (status <> 'sign_spa' or spa_signed_date is not null),
  constraint sales_cases_cancel_date_check check (status <> 'cancelled' or cancel_date is not null),
  constraint sales_cases_remark_check check (remark is null or char_length(remark) <= 2000),
  constraint sales_cases_soft_delete_check check ((not is_deleted and deleted_at is null) or (is_deleted and deleted_at is not null))
);

create table if not exists public.sales_case_contributors (
  id uuid primary key default gen_random_uuid(),
  sales_case_id uuid not null references public.sales_cases(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete restrict,
  portion numeric(7,4) not null,
  created_at timestamptz not null default now(),
  constraint sales_case_contributors_portion_check check (portion > 0 and portion <= 100),
  constraint sales_case_contributors_case_member_unique unique (sales_case_id, member_id)
);

create table if not exists public.sales_case_status_history (
  id uuid primary key default gen_random_uuid(),
  sales_case_id uuid not null references public.sales_cases(id) on delete cascade,
  status text not null,
  effective_date date null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  event_type text not null default 'lifecycle',
  note text null,
  constraint sales_case_status_history_status_check check (status in ('booking', 'submitted', 'loan_approved', 'sign_spa', 'cancelled')),
  constraint sales_case_status_history_event_type_check check (event_type in ('lifecycle', 'spa_correction')),
  constraint sales_case_status_history_note_check check (note is null or char_length(note) <= 1000)
);

create table if not exists public.sales_unit_history (
  id uuid primary key default gen_random_uuid(),
  sales_case_id uuid not null references public.sales_cases(id) on delete cascade,
  previous_unit_no text not null,
  new_unit_no text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id) on delete set null
);

alter table public.sales_cases enable row level security;
alter table public.sales_case_contributors enable row level security;
alter table public.sales_case_status_history enable row level security;
alter table public.sales_unit_history enable row level security;

create index if not exists sales_cases_booking_date_idx on public.sales_cases(booking_date desc) where not is_deleted;
create index if not exists sales_cases_project_booking_idx on public.sales_cases(project_id, booking_date desc) where not is_deleted;
create index if not exists sales_cases_status_idx on public.sales_cases(status) where not is_deleted;
create index if not exists sales_cases_spa_signed_date_idx on public.sales_cases(spa_signed_date desc) where spa_signed_date is not null and not is_deleted;
create index if not exists sales_case_contributors_member_idx on public.sales_case_contributors(member_id, sales_case_id);
create index if not exists sales_case_status_history_case_idx on public.sales_case_status_history(sales_case_id, created_at desc);
create index if not exists sales_unit_history_case_idx on public.sales_unit_history(sales_case_id, changed_at desc);

drop trigger if exists sales_cases_set_updated_at on public.sales_cases;
create trigger sales_cases_set_updated_at before update on public.sales_cases
for each row execute function public.set_project_knowledge_updated_at();

create or replace function public.save_sales_case(
  p_case_id uuid,
  p_project_id uuid,
  p_unit_no text,
  p_booking_date date,
  p_nett_price numeric,
  p_falcon_portion numeric,
  p_status text,
  p_spa_signed_date date,
  p_cancel_date date,
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
  v_old_unit text;
  v_old_status text;
  v_old_spa_signed_date date;
  v_falcon_scaled bigint;
  v_contributor_scaled bigint;
begin
  if p_falcon_portion is null or p_falcon_portion <= 0 or p_falcon_portion > 100 then
    raise exception 'Falcon Portion must be greater than 0 and no more than 100';
  end if;
  if scale(p_falcon_portion) > 4 then
    raise exception 'Falcon Portion cannot have more than 4 decimal places';
  end if;
  if jsonb_typeof(p_contributors) <> 'array' or jsonb_array_length(p_contributors) = 0 then
    raise exception 'At least one contributor is required';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_contributors) item
    where item->>'portion' is null
      or (item->>'portion') !~ '^([0-9]+)(\.[0-9]{1,4})?$'
      or (item->>'portion')::numeric <= 0
      or (item->>'portion')::numeric > 100
  ) then
    raise exception 'Each contributor portion must be greater than 0, no more than 100, and use at most 4 decimal places';
  end if;
  if (select count(*) from jsonb_array_elements(p_contributors)) <>
     (select count(distinct item->>'memberId') from jsonb_array_elements(p_contributors) item) then
    raise exception 'A contributor can only be selected once';
  end if;
  v_falcon_scaled := (p_falcon_portion * 10000)::bigint;
  select coalesce(sum(((item->>'portion')::numeric * 10000)::bigint), 0)
    into v_contributor_scaled
  from jsonb_array_elements(p_contributors) item;
  if v_contributor_scaled <> v_falcon_scaled then
    raise exception 'Contributor allocations must exactly equal Falcon Portion';
  end if;

  if p_spa_signed_date is not null and p_spa_signed_date < p_booking_date then
    raise exception 'SPA Signed Date cannot be before Booking Date';
  end if;
  if p_cancel_date is not null and p_cancel_date < p_booking_date then
    raise exception 'Cancel Date cannot be before Booking Date';
  end if;
  if p_spa_signed_date is not null and p_cancel_date is not null and p_cancel_date < p_spa_signed_date then
    raise exception 'Cancel Date cannot be before SPA Signed Date';
  end if;

  if p_case_id is null then
    if p_status <> 'sign_spa' and p_spa_signed_date is not null then
      raise exception 'SPA Signed Date may only be introduced by Sign SPA status';
    end if;
    insert into public.sales_cases (project_id, unit_no, booking_date, nett_price, falcon_portion, status, spa_signed_date, cancel_date, remark, created_by, updated_by)
    values (p_project_id, btrim(p_unit_no), p_booking_date, p_nett_price, p_falcon_portion, p_status, p_spa_signed_date, p_cancel_date, nullif(btrim(p_remark), ''), p_actor, p_actor)
    returning id into v_case_id;
    insert into public.sales_case_status_history (sales_case_id, status, effective_date, created_by)
    values (v_case_id, p_status, case when p_status = 'sign_spa' then p_spa_signed_date when p_status = 'cancelled' then p_cancel_date else p_booking_date end, p_actor);
  else
    select unit_no, status, spa_signed_date into v_old_unit, v_old_status, v_old_spa_signed_date
    from public.sales_cases where id = p_case_id and not is_deleted for update;
    if not found then raise exception 'Sales case not found'; end if;
    if v_old_status = 'cancelled' and p_status <> 'cancelled' then
      raise exception 'Cancelled cases are terminal. Create a new case for a rebooking';
    end if;
    if v_old_status = 'sign_spa' and p_status not in ('sign_spa', 'cancelled') then
      raise exception 'Use the explicit SPA correction action to remove an incorrect SPA record';
    end if;
    if v_old_spa_signed_date is null and p_status <> 'sign_spa' and p_spa_signed_date is not null then
      raise exception 'SPA Signed Date may only be introduced by Sign SPA status';
    end if;
    if p_status = 'cancelled' and v_old_spa_signed_date is not null and p_cancel_date < v_old_spa_signed_date then
      raise exception 'Cancel Date cannot be before SPA Signed Date';
    end if;
    v_case_id := p_case_id;
    update public.sales_cases set project_id=p_project_id, unit_no=btrim(p_unit_no), booking_date=p_booking_date,
      nett_price=p_nett_price, falcon_portion=p_falcon_portion, status=p_status,
      spa_signed_date=case when p_status='sign_spa' then p_spa_signed_date else coalesce(p_spa_signed_date, spa_signed_date) end,
      cancel_date=p_cancel_date, remark=nullif(btrim(p_remark), ''), updated_by=p_actor where id=v_case_id;
    if v_old_unit is distinct from btrim(p_unit_no) then
      insert into public.sales_unit_history (sales_case_id, previous_unit_no, new_unit_no, changed_by)
      values (v_case_id, v_old_unit, btrim(p_unit_no), p_actor);
    end if;
    if v_old_status is distinct from p_status then
      insert into public.sales_case_status_history (sales_case_id, status, effective_date, created_by)
      values (v_case_id, p_status, case when p_status='sign_spa' then p_spa_signed_date when p_status='cancelled' then p_cancel_date else current_date end, p_actor);
    end if;
    delete from public.sales_case_contributors where sales_case_id=v_case_id;
  end if;

  insert into public.sales_case_contributors (sales_case_id, member_id, portion)
  select v_case_id, (item->>'memberId')::uuid, (item->>'portion')::numeric
  from jsonb_array_elements(p_contributors) item;
  return v_case_id;
end;
$$;

revoke all on function public.save_sales_case(uuid,uuid,text,date,numeric,numeric,text,date,date,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_sales_case(uuid,uuid,text,date,numeric,numeric,text,date,date,text,jsonb,uuid) to service_role;

create or replace function public.correct_sales_case_spa(
  p_case_id uuid,
  p_restored_status text,
  p_note text,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_next_status text;
begin
  if p_note is null or length(btrim(p_note)) = 0 or char_length(btrim(p_note)) > 1000 then
    raise exception 'A correction note is required and must be 1,000 characters or fewer';
  end if;
  if p_restored_status not in ('booking', 'submitted', 'loan_approved') then
    raise exception 'Restored status must be Booking, Submitted, or Loan Approved';
  end if;

  select status into v_current_status from public.sales_cases
  where id = p_case_id and not is_deleted and spa_signed_date is not null for update;
  if not found then raise exception 'Converted Sales case not found'; end if;
  v_next_status := case when v_current_status = 'cancelled' then 'cancelled' else p_restored_status end;

  update public.sales_cases
  set status = v_next_status, spa_signed_date = null, updated_by = p_actor
  where id = p_case_id;
  insert into public.sales_case_status_history (sales_case_id, status, effective_date, created_by, event_type, note)
  values (p_case_id, v_next_status, current_date, p_actor, 'spa_correction', btrim(p_note));
end;
$$;

revoke all on function public.correct_sales_case_spa(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.correct_sales_case_spa(uuid,text,text,uuid) to service_role;
