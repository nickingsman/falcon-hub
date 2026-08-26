alter table public.users
  add column if not exists member_code integer;

create sequence if not exists public.users_member_code_seq
  as integer
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1
  owned by public.users.member_code;

update public.users as users
set member_code = 1
where users.id = 'a487ab9d-1c02-4a41-80b0-958e5e0260b7'::uuid
  and users.is_deleted = false;

do $$
begin
  if not exists (
    select 1
    from public.users as users
    where users.id = 'a487ab9d-1c02-4a41-80b0-958e5e0260b7'::uuid
      and users.member_code = 1
      and users.is_deleted = false
  ) then
    raise exception 'Confirmed production Nicholas Yap member row was not assigned member_code 1';
  end if;

  perform pg_catalog.setval(
    'public.users_member_code_seq'::regclass,
    1,
    true
  );
end;
$$;

alter table public.users
  alter column member_code set default nextval('public.users_member_code_seq'::regclass);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'users_member_code_positive_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_member_code_positive_check
      check (member_code is null or member_code > 0);
  end if;
end;
$$;

create unique index if not exists users_member_code_unique_idx
  on public.users(member_code)
  where member_code is not null;
