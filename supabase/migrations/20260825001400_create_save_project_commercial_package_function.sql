create or replace function public.save_project_commercial_package(
  p_project_id uuid,
  p_package_id uuid,
  p_package_name text,
  p_customer_description text default null,
  p_internal_note text default null,
  p_valid_from date default null,
  p_valid_until date default null,
  p_applies_to_all_unit_types boolean default true,
  p_furnishing_package_id uuid default null,
  p_sort_order integer default 0,
  p_unit_type_ids uuid[] default array[]::uuid[],
  p_items jsonb default '[]'::jsonb,
  p_purchase_costs jsonb default '[]'::jsonb
)
returns table (
  package_id uuid
)
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_package_id uuid;
  v_matching_unit_type_count integer;
begin
  if not exists (
    select 1
    from public.projects as project
    where project.id = p_project_id
      and project.is_deleted = false
  ) then
    raise exception 'Project not found';
  end if;

  if p_package_name is null or pg_catalog.btrim(p_package_name) = '' then
    raise exception 'Package Name is required';
  end if;

  if p_valid_from is not null
    and p_valid_until is not null
    and p_valid_until < p_valid_from
  then
    raise exception 'Valid Until must be on or after Valid From';
  end if;

  if p_furnishing_package_id is not null
    and not exists (
      select 1
      from public.project_furnishing_packages as furnishing_package
      where furnishing_package.id = p_furnishing_package_id
        and furnishing_package.project_id = p_project_id
        and furnishing_package.is_deleted = false
    )
  then
    raise exception 'Furnishing package must belong to this project';
  end if;

  if p_applies_to_all_unit_types = false then
    if p_unit_type_ids is null or pg_catalog.cardinality(p_unit_type_ids) = 0 then
      raise exception 'Select at least one Unit Type';
    end if;

    if (
      select pg_catalog.count(*)::integer
      from (
        select distinct unit_type_id
        from pg_catalog.unnest(p_unit_type_ids) as selected_unit_type(unit_type_id)
      ) as distinct_unit_types
    ) <> pg_catalog.cardinality(p_unit_type_ids) then
      raise exception 'Selected Unit Types must not contain duplicates';
    end if;

    select pg_catalog.count(*)::integer
      into v_matching_unit_type_count
    from public.project_unit_types as unit_type
    where unit_type.project_id = p_project_id
      and unit_type.is_deleted = false
      and unit_type.id = any(p_unit_type_ids);

    if v_matching_unit_type_count <> pg_catalog.cardinality(p_unit_type_ids) then
      raise exception 'Selected Unit Types must belong to this project';
    end if;
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'Package items must be an array';
  end if;

  if p_purchase_costs is null or pg_catalog.jsonb_typeof(p_purchase_costs) <> 'array' then
    raise exception 'Purchase costs must be an array';
  end if;

  if p_package_id is null then
    insert into public.project_commercial_packages (
      project_id,
      package_name,
      customer_description,
      internal_note,
      valid_from,
      valid_until,
      applies_to_all_unit_types,
      furnishing_package_id,
      sort_order,
      is_deleted
    )
    values (
      p_project_id,
      pg_catalog.btrim(p_package_name),
      p_customer_description,
      p_internal_note,
      p_valid_from,
      p_valid_until,
      p_applies_to_all_unit_types,
      p_furnishing_package_id,
      p_sort_order,
      false
    )
    returning id into v_package_id;
  else
    update public.project_commercial_packages as commercial_package
    set
      package_name = pg_catalog.btrim(p_package_name),
      customer_description = p_customer_description,
      internal_note = p_internal_note,
      valid_from = p_valid_from,
      valid_until = p_valid_until,
      applies_to_all_unit_types = p_applies_to_all_unit_types,
      furnishing_package_id = p_furnishing_package_id,
      sort_order = p_sort_order
    where commercial_package.id = p_package_id
      and commercial_package.project_id = p_project_id
      and commercial_package.is_deleted = false
    returning commercial_package.id into v_package_id;

    if v_package_id is null then
      raise exception 'Commercial package not found';
    end if;

    delete from public.project_commercial_package_unit_types as package_unit_type
    where package_unit_type.package_id = v_package_id;

    update public.project_commercial_package_items as package_item
    set
      is_deleted = true,
      deleted_at = pg_catalog.now()
    where package_item.package_id = v_package_id
      and package_item.is_deleted = false;

    delete from public.project_commercial_package_purchase_costs as purchase_cost
    where purchase_cost.package_id = v_package_id;
  end if;

  if p_applies_to_all_unit_types = false then
    insert into public.project_commercial_package_unit_types (
      package_id,
      unit_type_id
    )
    select
      v_package_id,
      selected_unit_type.unit_type_id
    from pg_catalog.unnest(p_unit_type_ids) as selected_unit_type(unit_type_id);
  end if;

  insert into public.project_commercial_package_items (
    package_id,
    item_type,
    description,
    discount_method,
    value,
    cash_benefit_treatment,
    receive_at,
    sort_order,
    is_deleted
  )
  select
    v_package_id,
    package_item.item_type,
    package_item.description,
    package_item.discount_method,
    package_item.value,
    package_item.cash_benefit_treatment,
    package_item.receive_at,
    package_item.sort_order,
    false
  from pg_catalog.jsonb_to_recordset(p_items) as package_item(
    item_type text,
    description text,
    discount_method text,
    value numeric,
    cash_benefit_treatment text,
    receive_at text,
    sort_order integer
  );

  insert into public.project_commercial_package_purchase_costs (
    package_id,
    cost_key,
    treatment,
    amount_override,
    sort_order
  )
  select
    v_package_id,
    purchase_cost.cost_key,
    purchase_cost.treatment,
    purchase_cost.amount_override,
    purchase_cost.sort_order
  from pg_catalog.jsonb_to_recordset(p_purchase_costs) as purchase_cost(
    cost_key text,
    treatment text,
    amount_override numeric,
    sort_order integer
  );

  return query select v_package_id;
end;
$$;

revoke all on function public.save_project_commercial_package(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date,
  boolean,
  uuid,
  integer,
  uuid[],
  jsonb,
  jsonb
) from public;

revoke all on function public.save_project_commercial_package(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date,
  boolean,
  uuid,
  integer,
  uuid[],
  jsonb,
  jsonb
) from anon;

revoke all on function public.save_project_commercial_package(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date,
  boolean,
  uuid,
  integer,
  uuid[],
  jsonb,
  jsonb
) from authenticated;

grant execute on function public.save_project_commercial_package(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  date,
  boolean,
  uuid,
  integer,
  uuid[],
  jsonb,
  jsonb
) to service_role;
