begin;

set local lock_timeout = '10s';
set local statement_timeout = '5min';

lock table public.sales_cases in access exclusive mode;
lock table public.sales_case_contributors in share mode;

-- Transaction-local helpers reproduce the database-native baseline hashes
-- captured from the verified 847-Sales production checkpoint. They disappear
-- at transaction end and do not add permanent database objects.
create function pg_temp.sales_precision_encode(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then 'N'
    else 'S' || replace(encode(convert_to(p_value, 'UTF8'), 'base64'), E'\n', '')
  end
$$;

create function pg_temp.sales_precision_numeric(p_value numeric)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then null
    when position('.' in p_value::text) > 0 then rtrim(rtrim(p_value::text, '0'), '.')
    else p_value::text
  end
$$;

create function pg_temp.sales_precision_sales_hash(p_scope text)
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(coalesce(string_agg(row_payload, chr(30) order by id::text collate "C"), ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  )
  from (
    select sales_case.id, concat_ws(chr(31),
      pg_temp.sales_precision_encode(sales_case.id::text),
      pg_temp.sales_precision_encode(sales_case.project_id::text),
      pg_temp.sales_precision_encode(sales_case.source_type),
      pg_temp.sales_precision_encode(sales_case.source_project_name),
      pg_temp.sales_precision_encode(sales_case.source_row::text),
      pg_temp.sales_precision_encode(sales_case.source_fingerprint),
      pg_temp.sales_precision_encode(sales_case.allocation_status),
      pg_temp.sales_precision_encode(sales_case.source_contributor_snapshot::text),
      pg_temp.sales_precision_encode(sales_case.unit_no),
      pg_temp.sales_precision_encode(sales_case.booking_date::text),
      pg_temp.sales_precision_encode(pg_temp.sales_precision_numeric(sales_case.nett_price)),
      pg_temp.sales_precision_encode(pg_temp.sales_precision_numeric(sales_case.falcon_portion)),
      pg_temp.sales_precision_encode(sales_case.status),
      pg_temp.sales_precision_encode(sales_case.spa_signed_date::text),
      pg_temp.sales_precision_encode(sales_case.cancel_date::text),
      pg_temp.sales_precision_encode(sales_case.remark),
      pg_temp.sales_precision_encode(sales_case.created_by::text),
      pg_temp.sales_precision_encode(sales_case.updated_by::text),
      pg_temp.sales_precision_encode(sales_case.is_deleted::text)
    ) as row_payload
    from public.sales_cases sales_case
    where sales_case.is_deleted = false
      and (
        (p_scope = 'original'
          and sales_case.source_type not in ('historical_2024_case_report', 'historical_2025_case_report'))
        or (p_scope = 'historical_2026'
          and sales_case.source_type = 'historical_2026_case_report')
      )
  ) selected_sales
$$;

create function pg_temp.sales_precision_contributors_hash()
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(coalesce(string_agg(
        row_payload,
        chr(30)
        order by sales_case_id::text collate "C",
          coalesce(member_id::text, '') collate "C",
          coalesce(source_member_name, '') collate "C"
      ), ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  )
  from (
    select
      contributor.sales_case_id,
      contributor.member_id,
      contributor.source_member_name,
      concat_ws(chr(31),
        pg_temp.sales_precision_encode(contributor.sales_case_id::text),
        pg_temp.sales_precision_encode(contributor.member_id::text),
        pg_temp.sales_precision_encode(contributor.source_member_name),
        pg_temp.sales_precision_encode(pg_temp.sales_precision_numeric(contributor.portion))
      ) as row_payload
    from public.sales_case_contributors contributor
    join public.sales_cases sales_case on sales_case.id = contributor.sales_case_id
    where sales_case.is_deleted = false
      and sales_case.source_type not in ('historical_2024_case_report', 'historical_2025_case_report')
  ) selected_contributors
$$;

do $$
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Required pgcrypto digest(bytea,text) function is unavailable';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_cases'
      and column_name = 'nett_price'
      and data_type = 'numeric'
      and numeric_precision = 15
      and numeric_scale = 2
  ) then
    raise exception 'sales_cases.nett_price is not numeric(15,2)';
  end if;

  if (select count(*) from public.sales_cases where is_deleted = false) <> 847 then
    raise exception 'Expected exactly 847 active Sales before the precision migration';
  end if;
  if (
    select count(*) from public.sales_cases
    where is_deleted = false and source_type = 'historical_2024_case_report'
  ) <> 392 then
    raise exception 'Expected exactly 392 active Historical 2024 Sales';
  end if;
  if (
    select count(*) from public.sales_cases
    where is_deleted = false and source_type = 'historical_2025_case_report'
  ) <> 0 then
    raise exception 'Historical 2025 Sales must remain empty before the precision migration';
  end if;
  if (
    select count(*) from public.sales_cases
    where is_deleted = false
      and source_type not in ('historical_2024_case_report', 'historical_2025_case_report')
  ) <> 455 then
    raise exception 'Expected exactly 455 original active Sales';
  end if;
  if (
    select count(*)
    from public.sales_case_contributors contributor
    join public.sales_cases sales_case on sales_case.id = contributor.sales_case_id
    where sales_case.is_deleted = false
      and sales_case.source_type not in ('historical_2024_case_report', 'historical_2025_case_report')
  ) <> 840 then
    raise exception 'Expected exactly 840 original contributor records';
  end if;
  if exists (
    select 1 from public.sales_cases
    where is_deleted = false
      and source_type not in ('historical_2024_case_report', 'historical_2025_case_report')
      and source_contributor_snapshot is not null
  ) then
    raise exception 'Original Sales source contributor snapshot baseline changed';
  end if;

  if pg_temp.sales_precision_sales_hash('original')
      <> '9c0512ab907e07c2416285cdb27d7c3c0467efa4a8e70d4ceca8f8e85ef25b5c' then
    raise exception 'Original 455 Sales database baseline hash changed';
  end if;
  if pg_temp.sales_precision_contributors_hash()
      <> 'fa81ef131f0f2c3996a5b9dd82a5e1f1386ac45ad0d0ebeb67a71c28807f6c78' then
    raise exception 'Original 840 contributor database baseline hash changed';
  end if;
  if pg_temp.sales_precision_sales_hash('historical_2026')
      <> 'ff19e725b561217a5db74dea4615626a668a6036ef152a8222e29d5779137d4c' then
    raise exception 'Historical 2026 database baseline hash changed';
  end if;

  if (
    select count(*) from public.sales_cases
    where is_deleted = false
      and source_type = 'historical_2024_case_report'
      and source_fingerprint = '61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c'
      and source_row = 223
      and source_project_name = 'BAMBOO HILLS'
      and unit_no = 'B-49-12'
      and nett_price = 639176.63
      and falcon_portion = 100
      and status = 'booking'
      and allocation_status = 'pending'
  ) <> 1 then
    raise exception 'Affected Historical 2024 Sales row does not match the approved precondition';
  end if;

  if (
    select count(*) from public.sales_cases
    where is_deleted = false
      and source_type = 'historical_2024_case_report'
      and nullif(btrim(source_fingerprint), '') is not null
  ) <> 392 or (
    select count(distinct source_fingerprint) from public.sales_cases
    where is_deleted = false and source_type = 'historical_2024_case_report'
  ) <> 392 then
    raise exception 'Historical 2024 fingerprints are incomplete or duplicated';
  end if;
end
$$;

-- Preserve the complete imported 2024 rows inside this transaction so the
-- postcondition can prove that only the approved Nett Price changed.
create temporary table sales_precision_2024_before
on commit drop
as
select sales_case.*
from public.sales_cases sales_case
where sales_case.is_deleted = false
  and sales_case.source_type = 'historical_2024_case_report';

do $$
begin
  if (select count(*) from pg_temp.sales_precision_2024_before) <> 392 then
    raise exception 'Failed to snapshot exactly 392 Historical 2024 Sales';
  end if;
end
$$;

alter table public.sales_cases
  alter column nett_price type numeric(16,3)
  using nett_price::numeric(16,3);

do $$
declare
  v_corrected integer;
begin
  update public.sales_cases
  set nett_price = 639176.625
  where is_deleted = false
    and source_type = 'historical_2024_case_report'
    and source_fingerprint = '61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c'
    and source_row = 223
    and source_project_name = 'BAMBOO HILLS'
    and unit_no = 'B-49-12'
    and nett_price = 639176.630
    and falcon_portion = 100
    and status = 'booking'
    and allocation_status = 'pending';

  get diagnostics v_corrected = row_count;
  if v_corrected <> 1 then
    raise exception 'Expected one corrected Historical 2024 Sales row, corrected %', v_corrected;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_cases'
      and column_name = 'nett_price'
      and data_type = 'numeric'
      and numeric_precision = 16
      and numeric_scale = 3
  ) then
    raise exception 'sales_cases.nett_price was not changed to numeric(16,3)';
  end if;

  if (select count(*) from public.sales_cases where is_deleted = false) <> 847
     or (select count(*) from public.sales_cases where is_deleted = false and source_type = 'historical_2024_case_report') <> 392
     or (select count(*) from public.sales_cases where is_deleted = false and source_type = 'historical_2025_case_report') <> 0 then
    raise exception 'Sales counts changed unexpectedly during the precision migration';
  end if;

  if (
    select count(*) from public.sales_cases
    where is_deleted = false
      and source_type = 'historical_2024_case_report'
      and source_fingerprint = '61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c'
      and nett_price = 639176.625
      and falcon_portion = 100
      and status = 'booking'
      and allocation_status = 'pending'
  ) <> 1 then
    raise exception 'Affected Historical 2024 Sales row was not corrected exactly';
  end if;

  if (
    select count(*)
    from public.sales_case_contributors contributor
    join public.sales_cases sales_case on sales_case.id = contributor.sales_case_id
    where sales_case.is_deleted = false
      and sales_case.source_type = 'historical_2024_case_report'
  ) <> 646 or exists (
    select 1
    from public.sales_case_contributors contributor
    join public.sales_cases sales_case on sales_case.id = contributor.sales_case_id
    where sales_case.is_deleted = false
      and sales_case.source_type = 'historical_2024_case_report'
      and contributor.portion is not null
  ) then
    raise exception 'Historical 2024 pending contributor records changed unexpectedly';
  end if;

  if exists (
    select 1 from public.sales_cases
    where is_deleted = false
      and source_type = 'historical_2024_case_report'
      and (status <> 'booking' or allocation_status <> 'pending')
  ) then
    raise exception 'Historical 2024 status or allocation state changed unexpectedly';
  end if;

  if (
    select sum(nett_price) from public.sales_cases
    where is_deleted = false and source_type = 'historical_2024_case_report'
  ) <> 290624074.525 or (
    select sum(nett_price * falcon_portion / 100) from public.sales_cases
    where is_deleted = false and source_type = 'historical_2024_case_report'
  ) <> 242806045.782500000 then
    raise exception 'Historical 2024 financial reconciliation failed';
  end if;

  if exists (
    select 1
    from pg_temp.sales_precision_2024_before before_row
    left join public.sales_cases current_row on current_row.id = before_row.id
    where current_row.id is null
      or case
        when before_row.source_fingerprint = '61489ba9e2f197af7fe84e9b2f1d1b4037126c1d4b783e59a7de4f17012e168c' then
          (to_jsonb(current_row) - 'nett_price' - 'updated_at')
            is distinct from (to_jsonb(before_row) - 'nett_price' - 'updated_at')
          or current_row.nett_price is distinct from 639176.625::numeric
          or current_row.updated_at is distinct from transaction_timestamp()
        else
          (to_jsonb(current_row) - 'nett_price')
            is distinct from (to_jsonb(before_row) - 'nett_price')
          or current_row.nett_price is distinct from before_row.nett_price::numeric
      end
  ) then
    raise exception 'A Historical 2024 Sales row changed outside the approved Nett Price correction';
  end if;

  if pg_temp.sales_precision_sales_hash('original')
      <> '9c0512ab907e07c2416285cdb27d7c3c0467efa4a8e70d4ceca8f8e85ef25b5c'
     or pg_temp.sales_precision_contributors_hash()
      <> 'fa81ef131f0f2c3996a5b9dd82a5e1f1386ac45ad0d0ebeb67a71c28807f6c78'
     or pg_temp.sales_precision_sales_hash('historical_2026')
      <> 'ff19e725b561217a5db74dea4615626a668a6036ef152a8222e29d5779137d4c' then
    raise exception 'Original Sales baseline changed during the precision migration';
  end if;
end
$$;

commit;
