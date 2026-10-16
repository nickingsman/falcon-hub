begin;

do $$
declare
  v_legacy_rpc oid := pg_catalog.to_regprocedure(
    'public.manage_falconhub_user(uuid,text,boolean,text,text,uuid,date,text)'
  )::oid;
  v_protected_wrapper oid := pg_catalog.to_regprocedure(
    'public.manage_falconhub_user_with_display_name(uuid,text,boolean,text,text,text,uuid,date,text)'
  )::oid;
begin
  if v_legacy_rpc is null then
    raise exception 'Legacy user-management RPC was not found' using errcode = 'P0002';
  end if;

  if v_protected_wrapper is null then
    raise exception 'Protected user-management wrapper was not found' using errcode = 'P0002';
  end if;

  if pg_catalog.has_function_privilege('authenticated', v_legacy_rpc, 'EXECUTE') then
    raise exception 'Legacy user-management RPC unexpectedly remains executable by authenticated'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_function_privilege('service_role', v_legacy_rpc, 'EXECUTE') then
    raise exception 'Legacy user-management RPC is not executable by service_role'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_function_privilege('authenticated', v_protected_wrapper, 'EXECUTE') then
    raise exception 'Protected user-management wrapper is not executable by authenticated'
      using errcode = '42501';
  end if;

  if pg_catalog.has_function_privilege('anon', v_protected_wrapper, 'EXECUTE') then
    raise exception 'Protected user-management wrapper unexpectedly remains executable by anon'
      using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.manage_falconhub_user(
  uuid,
  text,
  boolean,
  text,
  text,
  uuid,
  date,
  text
) from anon;

do $$
declare
  v_legacy_rpc oid := pg_catalog.to_regprocedure(
    'public.manage_falconhub_user(uuid,text,boolean,text,text,uuid,date,text)'
  )::oid;
  v_protected_wrapper oid := pg_catalog.to_regprocedure(
    'public.manage_falconhub_user_with_display_name(uuid,text,boolean,text,text,text,uuid,date,text)'
  )::oid;
begin
  if pg_catalog.has_function_privilege('anon', v_legacy_rpc, 'EXECUTE') then
    raise exception 'anon still has effective EXECUTE on the legacy user-management RPC'
      using errcode = '42501';
  end if;

  if pg_catalog.has_function_privilege('authenticated', v_legacy_rpc, 'EXECUTE') then
    raise exception 'authenticated unexpectedly has EXECUTE on the legacy user-management RPC'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_function_privilege('service_role', v_legacy_rpc, 'EXECUTE') then
    raise exception 'service_role lost EXECUTE on the legacy user-management RPC'
      using errcode = '42501';
  end if;

  if pg_catalog.has_function_privilege('anon', v_protected_wrapper, 'EXECUTE') then
    raise exception 'anon unexpectedly has EXECUTE on the protected user-management wrapper'
      using errcode = '42501';
  end if;

  if not pg_catalog.has_function_privilege('authenticated', v_protected_wrapper, 'EXECUTE') then
    raise exception 'authenticated lost EXECUTE on the protected user-management wrapper'
      using errcode = '42501';
  end if;
end;
$$;

commit;
