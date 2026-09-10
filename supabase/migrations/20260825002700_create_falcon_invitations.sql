create table if not exists public.falcon_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  email text not null,
  code_hash text not null,
  status text not null default 'active',
  expires_at timestamptz null,
  used_at timestamptz null,
  used_by_auth_user_id uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz null,
  constraint falcon_invitations_email_normalized_check
    check (email = pg_catalog.lower(pg_catalog.btrim(email)) and email <> ''),
  constraint falcon_invitations_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint falcon_invitations_status_check
    check (status in ('active', 'used', 'revoked', 'expired')),
  constraint falcon_invitations_state_check
    check (
      (status = 'active' and used_at is null and used_by_auth_user_id is null and revoked_at is null)
      or (status = 'used' and used_at is not null and used_by_auth_user_id is not null and revoked_at is null)
      or (status = 'revoked' and used_at is null and used_by_auth_user_id is null and revoked_at is not null)
      or (status = 'expired' and used_at is null and used_by_auth_user_id is null and revoked_at is null)
    )
);

alter table public.falcon_invitations enable row level security;

create unique index if not exists falcon_invitations_active_email_unique_idx
  on public.falcon_invitations(email)
  where status = 'active';

create index if not exists falcon_invitations_created_at_idx
  on public.falcon_invitations(created_at desc);

create or replace function public.consume_falcon_invitation(
  p_email text,
  p_code_hash text,
  p_auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_invitation_id uuid;
begin
  update public.falcon_invitations as invitation
  set
    status = 'used',
    used_at = pg_catalog.now(),
    used_by_auth_user_id = p_auth_user_id
  where invitation.email = pg_catalog.lower(pg_catalog.btrim(p_email))
    and invitation.code_hash = pg_catalog.lower(pg_catalog.btrim(p_code_hash))
    and invitation.status = 'active'
    and invitation.revoked_at is null
    and invitation.used_at is null
    and (invitation.expires_at is null or invitation.expires_at > pg_catalog.now())
    and exists (
      select 1
      from auth.users as auth_user
      where auth_user.id = p_auth_user_id
        and pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = invitation.email
    )
  returning invitation.id into v_invitation_id;

  return v_invitation_id;
end;
$$;

create or replace function public.release_falcon_invitation(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_released boolean := false;
begin
  update public.falcon_invitations as invitation
  set
    status = case
      when invitation.expires_at is not null and invitation.expires_at <= pg_catalog.now()
        then 'expired'
      else 'active'
    end,
    used_at = null,
    used_by_auth_user_id = null
  where invitation.id = p_invitation_id
    and invitation.status = 'used'
    and invitation.used_by_auth_user_id = p_auth_user_id;

  v_released := found;
  return v_released;
end;
$$;

revoke all on table public.falcon_invitations from public, anon, authenticated;
revoke all on function public.consume_falcon_invitation(text, text, uuid) from public, anon, authenticated;
revoke all on function public.release_falcon_invitation(uuid, uuid) from public, anon, authenticated;

grant all on table public.falcon_invitations to service_role;
grant execute on function public.consume_falcon_invitation(text, text, uuid) to service_role;
grant execute on function public.release_falcon_invitation(uuid, uuid) to service_role;
