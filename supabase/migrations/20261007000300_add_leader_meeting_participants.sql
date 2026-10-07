begin;

create table if not exists public.leader_discussion_item_participants (
  id uuid primary key default gen_random_uuid(),
  discussion_item_id uuid not null references public.leader_discussion_items(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete restrict,
  member_name_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint leader_discussion_item_participants_name_check
    check (char_length(btrim(member_name_snapshot)) between 1 and 160),
  constraint leader_discussion_item_participants_unique
    unique (discussion_item_id, member_id)
);

create table if not exists public.leader_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.leader_meetings(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete restrict,
  member_name_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint leader_meeting_participants_name_check
    check (char_length(btrim(member_name_snapshot)) between 1 and 160),
  constraint leader_meeting_participants_unique
    unique (meeting_id, member_id)
);

alter table public.leader_discussion_item_participants enable row level security;
alter table public.leader_meeting_participants enable row level security;

revoke all on table public.leader_discussion_item_participants from anon, authenticated;
revoke all on table public.leader_meeting_participants from anon, authenticated;

create index if not exists leader_discussion_item_participants_member_idx
  on public.leader_discussion_item_participants(member_id, discussion_item_id);
create index if not exists leader_meeting_participants_member_idx
  on public.leader_meeting_participants(member_id, meeting_id);
create index if not exists leader_discussion_items_status_created_idx
  on public.leader_discussion_items(status, created_at desc) where not is_deleted;

insert into public.leader_discussion_item_participants (
  discussion_item_id,
  member_id,
  member_name_snapshot,
  created_at
)
select
  discussion.id,
  discussion.meeting_with_member_id,
  concat(
    coalesce(nullif(btrim(member.display_name), ''), nullif(btrim(member.full_name), ''), 'Former member'),
    case when member.member_code is not null
      then ' (' || lpad(member.member_code::text, 3, '0') || ')'
      else ''
    end
  ),
  discussion.created_at
from public.leader_discussion_items discussion
join public.users member on member.id = discussion.meeting_with_member_id
on conflict (discussion_item_id, member_id) do nothing;

insert into public.leader_meeting_participants (
  meeting_id,
  member_id,
  member_name_snapshot,
  created_at
)
select
  meeting.id,
  meeting.meeting_with_member_id,
  meeting.meeting_with_name_snapshot,
  meeting.created_at
from public.leader_meetings meeting
on conflict (meeting_id, member_id) do nothing;

alter table public.leader_discussion_items
  drop column meeting_with_member_id;

alter table public.leader_meetings
  drop column meeting_with_member_id,
  drop column meeting_with_name_snapshot;

commit;
