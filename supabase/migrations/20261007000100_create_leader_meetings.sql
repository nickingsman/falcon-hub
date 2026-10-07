create table if not exists public.user_feature_access (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean not null default false,
  granted_at timestamptz null,
  granted_by uuid null references auth.users(id) on delete set null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, feature_key),
  constraint user_feature_access_feature_key_check
    check (feature_key in ('leader_meetings')),
  constraint user_feature_access_state_check check (
    (is_enabled and granted_at is not null and revoked_at is null and revoked_by is null)
    or
    (not is_enabled and revoked_at is not null)
  )
);

create table if not exists public.leader_discussion_items (
  id uuid primary key default gen_random_uuid(),
  meeting_with_member_id uuid not null references public.users(id) on delete restrict,
  topic text not null,
  notes text null,
  priority text not null default 'normal',
  status text not null default 'pending',
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  resolved_by_auth_user_id uuid null references auth.users(id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leader_discussion_items_topic_check check (char_length(btrim(topic)) between 1 and 240),
  constraint leader_discussion_items_notes_check check (notes is null or char_length(notes) <= 5000),
  constraint leader_discussion_items_priority_check check (priority in ('low', 'normal', 'high')),
  constraint leader_discussion_items_status_check check (status in ('pending', 'resolved', 'deferred', 'archived')),
  constraint leader_discussion_items_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null and resolved_by_auth_user_id is null)
  ),
  constraint leader_discussion_items_soft_delete_check check (
    (not is_deleted and deleted_at is null) or (is_deleted and deleted_at is not null)
  )
);

create table if not exists public.leader_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_with_member_id uuid not null references public.users(id) on delete restrict,
  meeting_with_name_snapshot text not null,
  meeting_date date not null,
  status text not null default 'in_progress',
  general_minutes text null,
  additional_notes text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  completed_by_auth_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leader_meetings_subject_snapshot_check check (char_length(btrim(meeting_with_name_snapshot)) between 1 and 160),
  constraint leader_meetings_status_check check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  constraint leader_meetings_general_minutes_check check (general_minutes is null or char_length(general_minutes) <= 20000),
  constraint leader_meetings_additional_notes_check check (additional_notes is null or char_length(additional_notes) <= 10000),
  constraint leader_meetings_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null and completed_by_auth_user_id is null)
  )
);

create table if not exists public.leader_meeting_topics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.leader_meetings(id) on delete restrict,
  discussion_item_id uuid null references public.leader_discussion_items(id) on delete restrict,
  topic_snapshot text not null,
  source_notes_snapshot text null,
  discussion_notes text null,
  decision_outcome text null,
  outcome_status text not null default 'discussed',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leader_meeting_topics_topic_check check (char_length(btrim(topic_snapshot)) between 1 and 240),
  constraint leader_meeting_topics_source_notes_check check (source_notes_snapshot is null or char_length(source_notes_snapshot) <= 5000),
  constraint leader_meeting_topics_discussion_check check (discussion_notes is null or char_length(discussion_notes) <= 10000),
  constraint leader_meeting_topics_decision_check check (decision_outcome is null or char_length(decision_outcome) <= 10000),
  constraint leader_meeting_topics_outcome_check check (outcome_status in ('discussed', 'resolved', 'deferred')),
  constraint leader_meeting_topics_sort_order_check check (sort_order >= 0)
);

create unique index if not exists leader_meeting_topics_meeting_discussion_unique
  on public.leader_meeting_topics(meeting_id, discussion_item_id)
  where discussion_item_id is not null;

create table if not exists public.leader_meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.leader_meetings(id) on delete restrict,
  meeting_topic_id uuid null references public.leader_meeting_topics(id) on delete restrict,
  action text not null,
  owner_member_id uuid not null references public.users(id) on delete restrict,
  owner_name_snapshot text not null,
  due_date date null,
  status text not null default 'open',
  completed_at timestamptz null,
  completed_by_auth_user_id uuid null references auth.users(id) on delete set null,
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leader_meeting_action_items_action_check check (char_length(btrim(action)) between 1 and 500),
  constraint leader_meeting_action_items_owner_snapshot_check check (char_length(btrim(owner_name_snapshot)) between 1 and 160),
  constraint leader_meeting_action_items_status_check check (status in ('open', 'completed', 'cancelled')),
  constraint leader_meeting_action_items_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null and completed_by_auth_user_id is null)
  )
);

alter table public.user_feature_access enable row level security;
alter table public.leader_discussion_items enable row level security;
alter table public.leader_meetings enable row level security;
alter table public.leader_meeting_topics enable row level security;
alter table public.leader_meeting_action_items enable row level security;

revoke all on table public.user_feature_access from anon, authenticated;
revoke all on table public.leader_discussion_items from anon, authenticated;
revoke all on table public.leader_meetings from anon, authenticated;
revoke all on table public.leader_meeting_topics from anon, authenticated;
revoke all on table public.leader_meeting_action_items from anon, authenticated;

create index if not exists user_feature_access_enabled_idx
  on public.user_feature_access(feature_key, auth_user_id) where is_enabled;
create index if not exists leader_discussion_items_member_status_idx
  on public.leader_discussion_items(meeting_with_member_id, status, created_at desc) where not is_deleted;
create index if not exists leader_meetings_member_date_idx
  on public.leader_meetings(meeting_with_member_id, meeting_date desc);
create index if not exists leader_meetings_status_date_idx
  on public.leader_meetings(status, meeting_date desc);
create index if not exists leader_meeting_topics_meeting_sort_idx
  on public.leader_meeting_topics(meeting_id, sort_order, created_at);
create index if not exists leader_meeting_action_items_open_due_idx
  on public.leader_meeting_action_items(status, due_date) where status = 'open';
create index if not exists leader_meeting_action_items_meeting_idx
  on public.leader_meeting_action_items(meeting_id, created_at);

drop trigger if exists user_feature_access_set_updated_at on public.user_feature_access;
create trigger user_feature_access_set_updated_at before update on public.user_feature_access
for each row execute function public.set_project_knowledge_updated_at();
drop trigger if exists leader_discussion_items_set_updated_at on public.leader_discussion_items;
create trigger leader_discussion_items_set_updated_at before update on public.leader_discussion_items
for each row execute function public.set_project_knowledge_updated_at();
drop trigger if exists leader_meetings_set_updated_at on public.leader_meetings;
create trigger leader_meetings_set_updated_at before update on public.leader_meetings
for each row execute function public.set_project_knowledge_updated_at();
drop trigger if exists leader_meeting_topics_set_updated_at on public.leader_meeting_topics;
create trigger leader_meeting_topics_set_updated_at before update on public.leader_meeting_topics
for each row execute function public.set_project_knowledge_updated_at();
drop trigger if exists leader_meeting_action_items_set_updated_at on public.leader_meeting_action_items;
create trigger leader_meeting_action_items_set_updated_at before update on public.leader_meeting_action_items
for each row execute function public.set_project_knowledge_updated_at();

create or replace function public.complete_leader_meeting(
  p_meeting_id uuid,
  p_actor uuid,
  p_general_minutes text,
  p_additional_notes text,
  p_topics jsonb
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_meeting public.leader_meetings%rowtype;
  v_topic jsonb;
  v_topic_id uuid;
  v_outcome text;
begin
  if not exists (
    select 1
    from public.user_profiles profile
    join public.user_feature_access access
      on access.auth_user_id = profile.auth_user_id
     and access.feature_key = 'leader_meetings'
     and access.is_enabled = true
    where profile.auth_user_id = p_actor
      and profile.status = 'active'
  ) then
    raise exception 'Leader Meetings access is required' using errcode = '42501';
  end if;

  select * into v_meeting
  from public.leader_meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  if v_meeting.status not in ('draft', 'in_progress') then
    raise exception 'Only an active meeting can be completed' using errcode = '22023';
  end if;
  if p_topics is null or jsonb_typeof(p_topics) <> 'array' then
    raise exception 'Meeting topics are required' using errcode = '22023';
  end if;
  if coalesce(char_length(p_general_minutes), 0) > 20000
     or coalesce(char_length(p_additional_notes), 0) > 10000 then
    raise exception 'Meeting notes exceed the allowed length' using errcode = '22023';
  end if;
  if jsonb_array_length(p_topics) <> (
    select count(*) from public.leader_meeting_topics where meeting_id = p_meeting_id
  ) then
    raise exception 'Every meeting topic must be included' using errcode = '22023';
  end if;
  if jsonb_array_length(p_topics) <> (
    select count(distinct value->>'id') from jsonb_array_elements(p_topics)
  ) then
    raise exception 'Meeting topic ids must be unique' using errcode = '22023';
  end if;

  for v_topic in select value from jsonb_array_elements(p_topics)
  loop
    begin
      v_topic_id := (v_topic->>'id')::uuid;
    exception when others then
      raise exception 'Meeting topic id is invalid' using errcode = '22023';
    end;
    v_outcome := v_topic->>'outcomeStatus';
    if v_outcome is null or v_outcome not in ('discussed', 'resolved', 'deferred') then
      raise exception 'Meeting topic outcome is invalid' using errcode = '22023';
    end if;
    if coalesce(char_length(v_topic->>'discussionNotes'), 0) > 10000
       or coalesce(char_length(v_topic->>'decisionOutcome'), 0) > 10000 then
      raise exception 'Topic notes exceed the allowed length' using errcode = '22023';
    end if;

    update public.leader_meeting_topics
    set discussion_notes = nullif(btrim(v_topic->>'discussionNotes'), ''),
        decision_outcome = nullif(btrim(v_topic->>'decisionOutcome'), ''),
        outcome_status = v_outcome
    where id = v_topic_id and meeting_id = p_meeting_id;
    if not found then
      raise exception 'Meeting topic not found' using errcode = 'P0002';
    end if;
  end loop;

  update public.leader_discussion_items discussion
  set status = case topic.outcome_status when 'resolved' then 'resolved' else 'deferred' end,
      resolved_at = case when topic.outcome_status = 'resolved' then now() else null end,
      resolved_by_auth_user_id = case when topic.outcome_status = 'resolved' then p_actor else null end
  from public.leader_meeting_topics topic
  where topic.meeting_id = p_meeting_id
    and topic.discussion_item_id = discussion.id
    and topic.outcome_status in ('resolved', 'deferred');

  update public.leader_meetings
  set general_minutes = nullif(btrim(p_general_minutes), ''),
      additional_notes = nullif(btrim(p_additional_notes), ''),
      status = 'completed',
      completed_at = now(),
      completed_by_auth_user_id = p_actor
  where id = p_meeting_id;

  return true;
end;
$$;

revoke all on function public.complete_leader_meeting(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.complete_leader_meeting(uuid, uuid, text, text, jsonb) to service_role;
