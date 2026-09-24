alter table public.falcon_locations
  alter column latitude type numeric(19,16),
  alter column longitude type numeric(19,16);

do $$
declare
  v_location record;
  v_match_count integer;
begin
  for v_location in
    select *
    from (
      values
        ('Arra Showroom', 'showroom', 3.111434::numeric, 101.582701::numeric),
        ('Falcon Office', 'office', 3.0829794301704596::numeric, 101.7015696422315::numeric),
        ('Ren Showroom', 'showroom', 3.0467428543348953::numeric, 101.66525514298799::numeric),
        ('Stellaris Showroom', 'showroom', 3.1867843093780577::numeric, 101.66567538666598::numeric)
    ) as verified_location(name, location_type, latitude, longitude)
  loop
    select count(*)
    into v_match_count
    from public.falcon_locations
    where lower(btrim(name)) = lower(v_location.name);

    if v_match_count > 1 then
      raise exception 'Expected at most one % location, found %', v_location.name, v_match_count;
    end if;

    if v_match_count = 0 then
      insert into public.falcon_locations (
        name,
        location_type,
        latitude,
        longitude,
        match_radius_meters,
        is_active
      )
      values (
        v_location.name,
        v_location.location_type,
        v_location.latitude,
        v_location.longitude,
        1000,
        true
      );
    else
      update public.falcon_locations
      set name = v_location.name,
          location_type = v_location.location_type,
          latitude = v_location.latitude,
          longitude = v_location.longitude,
          match_radius_meters = 1000,
          is_active = true
      where lower(btrim(name)) = lower(v_location.name);
    end if;
  end loop;
end
$$;
