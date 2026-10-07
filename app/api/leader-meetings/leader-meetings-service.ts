import { NextResponse } from "next/server";
import { getMemberDisplayName, formatMemberDisplayName } from "@/lib/member-display";
import { getMalaysiaTodayDateString, isValidDateString } from "@/lib/malaysia-date";
import { requireLeaderMeetingsAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  attachActionAssignees,
  attachParticipantSnapshots,
  haveParticipantOverlap,
  leaderDiscussionPriorities,
  leaderDiscussionStatuses,
  leaderMeetingActionStatuses,
  leaderMeetingTopicOutcomes,
  parseAssigneeMemberIds,
  parseParticipantMemberIds,
} from "@/lib/leader-meetings";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const discussionPriorities = leaderDiscussionPriorities;
export const discussionStatuses = leaderDiscussionStatuses;
export const topicOutcomes = leaderMeetingTopicOutcomes;
export const actionStatuses = leaderMeetingActionStatuses;

type MemberRow = {
  id: string;
  member_code: number | null;
  full_name: string | null;
  display_name: string | null;
  position: string | null;
  status: string | null;
};

type ActionAssigneeRow = {
  id: string;
  action_item_id: string;
  member_id: string;
  member_name_snapshot: string;
};

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound(error: string) {
  return NextResponse.json({ error }, { status: 404 });
}

export function serverError(error = "Unable to process Leader Meetings request") {
  return NextResponse.json({ error }, { status: 500 });
}

export function readText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return required ? undefined : null;
  const text = value.trim();
  if (!text) return required ? undefined : null;
  return text.length <= maxLength ? text : undefined;
}

export async function getLeaderMeetingsContext() {
  const authorization = await requireLeaderMeetingsAccess();
  if (!authorization.authorized) return authorization;
  return {
    ...authorization,
    supabase: createSupabaseAdminClient(),
  };
}

async function getSelectableMembers(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  memberIds: string[],
) {
  if (memberIds.some((memberId) => !uuidPattern.test(memberId))) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, member_code, full_name, display_name, position, status")
    .in("id", memberIds)
    .eq("is_deleted", false)
    .eq("status", "Active");
  if (error) throw error;
  const members = (data ?? []) as MemberRow[];
  if (members.length !== memberIds.length) return null;
  const memberMap = new Map(members.map((member) => [member.id, member]));
  return memberIds.map((memberId) => memberMap.get(memberId)!);
}

export function toMemberOption(member: MemberRow) {
  return {
    id: member.id,
    memberCode: member.member_code,
    fullName: member.full_name,
    displayName: member.display_name,
    name: getMemberDisplayName(member),
    label: formatMemberDisplayName(member),
    position: member.position,
    status: member.status,
  };
}

async function loadActionAssignees(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  actionIds: string[],
) {
  if (!actionIds.length) return [];
  const { data, error } = await supabase
    .from("leader_meeting_action_item_assignees")
    .select("id, action_item_id, member_id, member_name_snapshot")
    .in("action_item_id", actionIds)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ActionAssigneeRow[];
}

async function loadDiscussionParticipants(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  discussionItemIds: string[],
) {
  if (!discussionItemIds.length) return [];
  const { data, error } = await supabase
    .from("leader_discussion_item_participants")
    .select("id, discussion_item_id, member_id, member_name_snapshot")
    .in("discussion_item_id", discussionItemIds)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((participant) => ({
    id: participant.id,
    parent_id: participant.discussion_item_id,
    member_id: participant.member_id,
    member_name_snapshot: participant.member_name_snapshot,
  }));
}

async function loadMeetingParticipants(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  meetingIds: string[],
) {
  if (!meetingIds.length) return [];
  const { data, error } = await supabase
    .from("leader_meeting_participants")
    .select("id, meeting_id, member_id, member_name_snapshot")
    .in("meeting_id", meetingIds)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((participant) => ({
    id: participant.id,
    parent_id: participant.meeting_id,
    member_id: participant.member_id,
    member_name_snapshot: participant.member_name_snapshot,
  }));
}

export async function listMemberOptions() {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  try {
    const { data, error } = await context.supabase
      .from("users")
      .select("id, member_code, full_name, display_name, position, status")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("full_name");
    if (error) throw error;
    return NextResponse.json({ members: ((data ?? []) as MemberRow[]).map(toMemberOption) });
  } catch (error) {
    console.error("GET Leader Meetings member options failed", error);
    return serverError("Unable to load member options");
  }
}

export async function getOverview() {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  try {
    const [discussionResult, actionResult, meetingResult] = await Promise.all([
      context.supabase.from("leader_discussion_items").select("id, topic, notes, priority, status, created_at").eq("is_deleted", false).in("status", ["pending", "deferred"]).order("created_at", { ascending: false }),
      context.supabase.from("leader_meeting_action_items").select("id, meeting_id, action, due_date, status, created_at").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
      context.supabase.from("leader_meetings").select("id, meeting_date, completed_at").eq("status", "completed").order("meeting_date", { ascending: false }).limit(12),
    ]);
    if (discussionResult.error) throw discussionResult.error;
    if (actionResult.error) throw actionResult.error;
    if (meetingResult.error) throw meetingResult.error;

    const discussions = discussionResult.data ?? [];
    const actions = actionResult.data ?? [];
    const meetings = meetingResult.data ?? [];
    const meetingIds = [...new Set([...actions.map((item) => item.meeting_id), ...meetings.map((item) => item.id)])];
    const [actionAssignees, discussionParticipants, meetingParticipants, topicCountsResult, meetingActionResult, meetingLookupResult] = await Promise.all([
      loadActionAssignees(context.supabase, actions.map((action) => action.id)),
      loadDiscussionParticipants(context.supabase, discussions.map((discussion) => discussion.id)),
      loadMeetingParticipants(context.supabase, meetingIds),
      meetingIds.length ? context.supabase.from("leader_meeting_topics").select("meeting_id, decision_outcome").in("meeting_id", meetingIds) : Promise.resolve({ data: [], error: null }),
      meetingIds.length ? context.supabase.from("leader_meeting_action_items").select("meeting_id, status").in("meeting_id", meetingIds) : Promise.resolve({ data: [], error: null }),
      meetingIds.length ? context.supabase.from("leader_meetings").select("id, meeting_date").in("id", meetingIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (topicCountsResult.error) throw topicCountsResult.error;
    if (meetingActionResult.error) throw meetingActionResult.error;
    if (meetingLookupResult.error) throw meetingLookupResult.error;
    const meetingsWithParticipants = attachParticipantSnapshots(meetingLookupResult.data ?? [], meetingParticipants);
    const meetingMap = new Map(meetingsWithParticipants.map((meeting) => [meeting.id, meeting]));
    const recentMeetings = attachParticipantSnapshots(meetings, meetingParticipants);

    return NextResponse.json({
      discussionItems: attachParticipantSnapshots(discussions, discussionParticipants),
      openActions: attachActionAssignees(actions, actionAssignees).map((action) => ({
        ...action,
        meetingParticipants: meetingMap.get(action.meeting_id)?.participants ?? [],
        meetingDate: meetingMap.get(action.meeting_id)?.meeting_date ?? null,
      })),
      recentMeetings: recentMeetings.map((meeting) => ({
        ...meeting,
        topicCount: (topicCountsResult.data ?? []).filter((topic) => topic.meeting_id === meeting.id).length,
        decisionCount: (topicCountsResult.data ?? []).filter((topic) => topic.meeting_id === meeting.id && Boolean(topic.decision_outcome)).length,
        openActionCount: (meetingActionResult.data ?? []).filter((action) => action.meeting_id === meeting.id && action.status === "open").length,
      })),
      today: getMalaysiaTodayDateString(),
    });
  } catch (error) {
    console.error("GET Leader Meetings overview failed", error);
    return serverError("Unable to load Leader Meetings");
  }
}

export async function createDiscussionItem(request: Request) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const parsedParticipants = parseParticipantMemberIds(body.participantMemberIds);
    const topic = readText(body.topic, 240, true);
    const notes = readText(body.notes, 5000);
    const priority = typeof body.priority === "string" && discussionPriorities.includes(body.priority as never) ? body.priority : "normal";
    if (!parsedParticipants.valid) return badRequest(parsedParticipants.reason === "duplicate" ? "A participant can only be selected once" : "Select at least one active participant");
    const members = await getSelectableMembers(context.supabase, parsedParticipants.memberIds);
    if (!members) return badRequest("Select only active participants");
    if (!topic) return badRequest("Topic is required and must be 240 characters or fewer");
    if (notes === undefined) return badRequest("Notes must be 5,000 characters or fewer");
    const { data, error } = await context.supabase.from("leader_discussion_items").insert({ topic, notes, priority, created_by_auth_user_id: context.user.id }).select("id").single();
    if (error) throw error;
    const { error: participantError } = await context.supabase.from("leader_discussion_item_participants").insert(members.map((member) => ({ discussion_item_id: data.id, member_id: member.id, member_name_snapshot: formatMemberDisplayName(member) })));
    if (participantError) {
      await context.supabase.from("leader_discussion_items").delete().eq("id", data.id);
      throw participantError;
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("POST Leader Meetings discussion item failed", error);
    return serverError("Unable to add discussion item");
  }
}

export async function updateDiscussionItem(request: Request, itemId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(itemId)) return badRequest("Discussion item id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    let participantMembers: MemberRow[] | null = null;
    if (Object.hasOwn(body, "participantMemberIds")) {
      const parsedParticipants = parseParticipantMemberIds(body.participantMemberIds);
      if (!parsedParticipants.valid) return badRequest(parsedParticipants.reason === "duplicate" ? "A participant can only be selected once" : "Select at least one active participant");
      participantMembers = await getSelectableMembers(context.supabase, parsedParticipants.memberIds);
      if (!participantMembers) return badRequest("Select only active participants");
    }
    if (Object.hasOwn(body, "topic")) {
      const topic = readText(body.topic, 240, true);
      if (!topic) return badRequest("Topic is required and must be 240 characters or fewer");
      updates.topic = topic;
    }
    if (Object.hasOwn(body, "notes")) {
      const notes = readText(body.notes, 5000);
      if (notes === undefined) return badRequest("Notes must be 5,000 characters or fewer");
      updates.notes = notes;
    }
    if (Object.hasOwn(body, "priority")) {
      if (typeof body.priority !== "string" || !discussionPriorities.includes(body.priority as never)) return badRequest("Priority is invalid");
      updates.priority = body.priority;
    }
    if (body.status === "archived") updates.status = "archived";
    if (!Object.keys(updates).length && !participantMembers) return badRequest("No valid changes were supplied");
    const { data, error } = Object.keys(updates).length
      ? await context.supabase.from("leader_discussion_items").update(updates).eq("id", itemId).eq("is_deleted", false).neq("status", "resolved").select("id").maybeSingle()
      : await context.supabase.from("leader_discussion_items").select("id").eq("id", itemId).eq("is_deleted", false).neq("status", "resolved").maybeSingle();
    if (error) throw error;
    if (!data) return notFound("Discussion item not found");
    if (participantMembers) {
      const { data: existing, error: existingError } = await context.supabase.from("leader_discussion_item_participants").select("member_id").eq("discussion_item_id", itemId);
      if (existingError) throw existingError;
      const desiredIds = new Set(participantMembers.map((member) => member.id));
      const existingIds = new Set((existing ?? []).map((participant) => participant.member_id));
      const additions = participantMembers.filter((member) => !existingIds.has(member.id));
      const removals = [...existingIds].filter((memberId) => !desiredIds.has(memberId));
      if (additions.length) {
        const { error: addError } = await context.supabase.from("leader_discussion_item_participants").insert(additions.map((member) => ({ discussion_item_id: itemId, member_id: member.id, member_name_snapshot: formatMemberDisplayName(member) })));
        if (addError) throw addError;
      }
      if (removals.length) {
        const { error: removeError } = await context.supabase.from("leader_discussion_item_participants").delete().eq("discussion_item_id", itemId).in("member_id", removals);
        if (removeError) throw removeError;
      }
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("PATCH Leader Meetings discussion item failed", error);
    return serverError("Unable to update discussion item");
  }
}

export async function archiveDiscussionItem(itemId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(itemId)) return badRequest("Discussion item id is invalid");
  try {
    const { data, error } = await context.supabase.from("leader_discussion_items").update({ status: "archived" }).eq("id", itemId).eq("is_deleted", false).neq("status", "resolved").select("id").maybeSingle();
    if (error) throw error;
    if (!data) return notFound("Discussion item not found");
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("DELETE Leader Meetings discussion item failed", error);
    return serverError("Unable to archive discussion item");
  }
}

export async function createMeeting(request: Request) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const parsedParticipants = parseParticipantMemberIds(body.participantMemberIds);
    const meetingDate = typeof body.meetingDate === "string" ? body.meetingDate : "";
    if (!parsedParticipants.valid) return badRequest(parsedParticipants.reason === "duplicate" ? "A participant can only be selected once" : "Select at least one active participant");
    const members = await getSelectableMembers(context.supabase, parsedParticipants.memberIds);
    if (!members) return badRequest("Select only active participants");
    if (!isValidDateString(meetingDate)) return badRequest("Meeting date is invalid");
    if (!Array.isArray(body.discussionItemIds) || body.discussionItemIds.some((itemId) => typeof itemId !== "string" || !uuidPattern.test(itemId))) return badRequest("Selected discussion items are invalid");
    const discussionItemIds = body.discussionItemIds as string[];
    if (new Set(discussionItemIds).size !== discussionItemIds.length) return badRequest("A discussion item can only be selected once");
    const { data: discussions, error: discussionError } = discussionItemIds.length
      ? await context.supabase.from("leader_discussion_items").select("id, topic, notes").in("id", discussionItemIds).eq("is_deleted", false).in("status", ["pending", "deferred"])
      : { data: [], error: null };
    if (discussionError) throw discussionError;
    if ((discussions ?? []).length !== discussionItemIds.length) return badRequest("One or more selected discussion items are unavailable");
    const discussionParticipants = await loadDiscussionParticipants(context.supabase, discussionItemIds);
    const participantIdsByDiscussion = new Map<string, string[]>();
    for (const participant of discussionParticipants) {
      const ids = participantIdsByDiscussion.get(participant.parent_id) ?? [];
      ids.push(participant.member_id);
      participantIdsByDiscussion.set(participant.parent_id, ids);
    }
    if (discussionItemIds.some((itemId) => !haveParticipantOverlap(parsedParticipants.memberIds, participantIdsByDiscussion.get(itemId) ?? []))) return badRequest("Selected discussion items must share at least one meeting participant");
    const { data: meeting, error: meetingError } = await context.supabase.from("leader_meetings").insert({ meeting_date: meetingDate, status: "in_progress", created_by_auth_user_id: context.user.id }).select("id").single();
    if (meetingError) throw meetingError;
    const { error: meetingParticipantError } = await context.supabase.from("leader_meeting_participants").insert(members.map((member) => ({ meeting_id: meeting.id, member_id: member.id, member_name_snapshot: formatMemberDisplayName(member) })));
    if (meetingParticipantError) {
      await context.supabase.from("leader_meetings").delete().eq("id", meeting.id);
      throw meetingParticipantError;
    }
    if (discussions?.length) {
      const discussionMap = new Map(discussions.map((discussion) => [discussion.id, discussion]));
      const { error: topicError } = await context.supabase.from("leader_meeting_topics").insert(discussionItemIds.map((itemId, index) => { const item = discussionMap.get(itemId)!; return { meeting_id: meeting.id, discussion_item_id: item.id, topic_snapshot: item.topic, source_notes_snapshot: item.notes, sort_order: index }; }));
      if (topicError) {
        await context.supabase.from("leader_meetings").delete().eq("id", meeting.id);
        throw topicError;
      }
    }
    return NextResponse.json({ id: meeting.id }, { status: 201 });
  } catch (error) {
    console.error("POST Leader Meeting failed", error);
    return serverError("Unable to start meeting");
  }
}

export async function getMeeting(meetingId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(meetingId)) return badRequest("Meeting id is invalid");
  try {
    const [meetingResult, topicsResult, actionsResult] = await Promise.all([
      context.supabase.from("leader_meetings").select("id, meeting_date, status, general_minutes, additional_notes, started_at, completed_at, created_at, updated_at").eq("id", meetingId).maybeSingle(),
      context.supabase.from("leader_meeting_topics").select("id, discussion_item_id, topic_snapshot, source_notes_snapshot, discussion_notes, decision_outcome, outcome_status, sort_order").eq("meeting_id", meetingId).order("sort_order"),
      context.supabase.from("leader_meeting_action_items").select("id, meeting_topic_id, action, due_date, status, completed_at").eq("meeting_id", meetingId).order("created_at"),
    ]);
    if (meetingResult.error) throw meetingResult.error;
    if (topicsResult.error) throw topicsResult.error;
    if (actionsResult.error) throw actionsResult.error;
    if (!meetingResult.data) return notFound("Meeting not found");
    const actions = actionsResult.data ?? [];
    const [assignees, participants] = await Promise.all([
      loadActionAssignees(context.supabase, actions.map((action) => action.id)),
      loadMeetingParticipants(context.supabase, [meetingId]),
    ]);
    return NextResponse.json({ meeting: attachParticipantSnapshots([meetingResult.data], participants)[0], topics: topicsResult.data ?? [], actions: attachActionAssignees(actions, assignees) });
  } catch (error) {
    console.error("GET Leader Meeting failed", error);
    return serverError("Unable to load meeting");
  }
}

export async function saveMeetingDraft(request: Request, meetingId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(meetingId)) return badRequest("Meeting id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    const generalMinutes = readText(body.generalMinutes, 20000);
    const additionalNotes = readText(body.additionalNotes, 10000);
    if (generalMinutes === undefined || additionalNotes === undefined) return badRequest("Meeting notes exceed the allowed length");
    if (!Array.isArray(body.topics)) return badRequest("Meeting topics are required");
    const { data: meeting, error: meetingError } = await context.supabase.from("leader_meetings").update({ general_minutes: generalMinutes, additional_notes: additionalNotes }).eq("id", meetingId).in("status", ["draft", "in_progress"]).select("id").maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting) return notFound("Active meeting not found");
    for (const raw of body.topics) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return badRequest("Meeting topic is invalid");
      const topic = raw as Record<string, unknown>;
      if (typeof topic.id !== "string" || !uuidPattern.test(topic.id)) return badRequest("Meeting topic id is invalid");
      const discussionNotes = readText(topic.discussionNotes, 10000);
      const decisionOutcome = readText(topic.decisionOutcome, 10000);
      if (discussionNotes === undefined || decisionOutcome === undefined) return badRequest("Topic notes exceed the allowed length");
      if (typeof topic.outcomeStatus !== "string" || !topicOutcomes.includes(topic.outcomeStatus as never)) return badRequest("Topic outcome is invalid");
      const { error } = await context.supabase.from("leader_meeting_topics").update({ discussion_notes: discussionNotes, decision_outcome: decisionOutcome, outcome_status: topic.outcomeStatus }).eq("id", topic.id).eq("meeting_id", meetingId);
      if (error) throw error;
    }
    return NextResponse.json({ id: meetingId });
  } catch (error) {
    console.error("PATCH Leader Meeting failed", error);
    return serverError("Unable to save meeting draft");
  }
}

export async function addAdHocTopic(request: Request, meetingId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(meetingId)) return badRequest("Meeting id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    const topic = readText(body.topic, 240, true);
    if (!topic) return badRequest("Topic is required and must be 240 characters or fewer");
    const { data: meeting, error: meetingError } = await context.supabase.from("leader_meetings").select("id").eq("id", meetingId).in("status", ["draft", "in_progress"]).maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting) return notFound("Active meeting not found");
    const { count, error: countError } = await context.supabase.from("leader_meeting_topics").select("id", { count: "exact", head: true }).eq("meeting_id", meetingId);
    if (countError) throw countError;
    const { data, error } = await context.supabase.from("leader_meeting_topics").insert({ meeting_id: meetingId, topic_snapshot: topic, sort_order: count ?? 0 }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("POST Leader Meeting topic failed", error);
    return serverError("Unable to add topic");
  }
}

export async function addActionItem(request: Request, meetingId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(meetingId)) return badRequest("Meeting id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = readText(body.action, 500, true);
    const parsedAssignees = parseAssigneeMemberIds(body.assigneeMemberIds);
    const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;
    if (!action) return badRequest("Action is required and must be 500 characters or fewer");
    if (!parsedAssignees.valid) {
      return badRequest(parsedAssignees.reason === "duplicate" ? "An assignee can only be selected once" : "Select at least one active assignee");
    }
    if (parsedAssignees.memberIds.some((memberId) => !uuidPattern.test(memberId))) return badRequest("Select only valid active assignees");
    if (dueDate && !isValidDateString(dueDate)) return badRequest("Due date is invalid");
    const { data: assigneeMembers, error: assigneeError } = await context.supabase
      .from("users")
      .select("id, member_code, full_name, display_name, position, status")
      .in("id", parsedAssignees.memberIds)
      .eq("is_deleted", false)
      .eq("status", "Active");
    if (assigneeError) throw assigneeError;
    const memberMap = new Map(((assigneeMembers ?? []) as MemberRow[]).map((member) => [member.id, member]));
    if (memberMap.size !== parsedAssignees.memberIds.length) return badRequest("Select only active assignees");
    const { data: meeting, error: meetingError } = await context.supabase.from("leader_meetings").select("id").eq("id", meetingId).in("status", ["draft", "in_progress"]).maybeSingle();
    if (meetingError) throw meetingError;
    if (!meeting) return notFound("Active meeting not found");
    const meetingTopicId = typeof body.meetingTopicId === "string" && uuidPattern.test(body.meetingTopicId) ? body.meetingTopicId : null;
    if (meetingTopicId) {
      const { data: topic, error } = await context.supabase.from("leader_meeting_topics").select("id").eq("id", meetingTopicId).eq("meeting_id", meetingId).maybeSingle();
      if (error) throw error;
      if (!topic) return badRequest("Action topic does not belong to this meeting");
    }
    const { data, error } = await context.supabase.from("leader_meeting_action_items").insert({ meeting_id: meetingId, meeting_topic_id: meetingTopicId, action, due_date: dueDate, created_by_auth_user_id: context.user.id }).select("id").single();
    if (error) throw error;
    const { error: insertAssigneeError } = await context.supabase
      .from("leader_meeting_action_item_assignees")
      .insert(parsedAssignees.memberIds.map((memberId) => ({
        action_item_id: data.id,
        member_id: memberId,
        member_name_snapshot: formatMemberDisplayName(memberMap.get(memberId)!),
      })));
    if (insertAssigneeError) {
      await context.supabase.from("leader_meeting_action_items").delete().eq("id", data.id);
      throw insertAssigneeError;
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("POST Leader Meeting action failed", error);
    return serverError("Unable to add action item");
  }
}

export async function updateActionItem(request: Request, actionId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(actionId)) return badRequest("Action item id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.status !== "string" || !actionStatuses.includes(body.status as never)) return badRequest("Action status is invalid");
    const updates = body.status === "completed"
      ? { status: "completed", completed_at: new Date().toISOString(), completed_by_auth_user_id: context.user.id }
      : { status: body.status, completed_at: null, completed_by_auth_user_id: null };
    const { data, error } = await context.supabase.from("leader_meeting_action_items").update(updates).eq("id", actionId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return notFound("Action item not found");
    return NextResponse.json({ id: data.id, status: body.status });
  } catch (error) {
    console.error("PATCH Leader Meeting action failed", error);
    return serverError("Unable to update action item");
  }
}

export async function completeMeeting(request: Request, meetingId: string) {
  const context = await getLeaderMeetingsContext();
  if (!context.authorized) return context.response;
  if (!uuidPattern.test(meetingId)) return badRequest("Meeting id is invalid");
  try {
    const body = await request.json() as Record<string, unknown>;
    const generalMinutes = readText(body.generalMinutes, 20000);
    const additionalNotes = readText(body.additionalNotes, 10000);
    if (generalMinutes === undefined || additionalNotes === undefined || !Array.isArray(body.topics)) return badRequest("Meeting completion payload is invalid");
    const topics = body.topics.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Meeting topic is invalid");
      const topic = raw as Record<string, unknown>;
      const discussionNotes = readText(topic.discussionNotes, 10000);
      const decisionOutcome = readText(topic.decisionOutcome, 10000);
      if (typeof topic.id !== "string" || !uuidPattern.test(topic.id) || discussionNotes === undefined || decisionOutcome === undefined || typeof topic.outcomeStatus !== "string" || !topicOutcomes.includes(topic.outcomeStatus as never)) throw new Error("Meeting topic is invalid");
      return { id: topic.id, discussionNotes, decisionOutcome, outcomeStatus: topic.outcomeStatus };
    });
    const { error } = await context.supabase.rpc("complete_leader_meeting", { p_meeting_id: meetingId, p_actor: context.user.id, p_general_minutes: generalMinutes ?? "", p_additional_notes: additionalNotes ?? "", p_topics: topics });
    if (error) {
      if (["22023", "P0002"].includes(error.code ?? "")) return badRequest(error.message);
      throw error;
    }
    return NextResponse.json({ id: meetingId, status: "completed" });
  } catch (error) {
    if (error instanceof Error && error.message === "Meeting topic is invalid") return badRequest(error.message);
    console.error("POST complete Leader Meeting failed", error);
    return serverError("Unable to complete meeting");
  }
}
