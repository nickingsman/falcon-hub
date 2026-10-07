begin;

create table if not exists public.leader_meeting_action_item_assignees (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.leader_meeting_action_items(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete restrict,
  member_name_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint leader_meeting_action_item_assignees_name_check
    check (char_length(btrim(member_name_snapshot)) between 1 and 160),
  constraint leader_meeting_action_item_assignees_unique
    unique (action_item_id, member_id)
);

alter table public.leader_meeting_action_item_assignees enable row level security;
revoke all on table public.leader_meeting_action_item_assignees from anon, authenticated;

create index if not exists leader_meeting_action_item_assignees_member_idx
  on public.leader_meeting_action_item_assignees(member_id, action_item_id);

insert into public.leader_meeting_action_item_assignees (
  action_item_id,
  member_id,
  member_name_snapshot,
  created_at
)
select
  action_item.id,
  action_item.owner_member_id,
  action_item.owner_name_snapshot,
  action_item.created_at
from public.leader_meeting_action_items action_item
on conflict (action_item_id, member_id) do nothing;

alter table public.leader_meeting_action_items
  drop column owner_member_id,
  drop column owner_name_snapshot;

commit;
