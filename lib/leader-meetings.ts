export const leaderDiscussionPriorities = ["low", "normal", "high"] as const;
export const leaderDiscussionStatuses = ["pending", "resolved", "deferred", "archived"] as const;
export const leaderMeetingTopicOutcomes = ["discussed", "resolved", "deferred"] as const;
export const leaderMeetingActionStatuses = ["open", "completed", "cancelled"] as const;

export type LeaderDiscussionStatus = (typeof leaderDiscussionStatuses)[number];
export type LeaderMeetingTopicOutcome = (typeof leaderMeetingTopicOutcomes)[number];

export type LeaderMeetingActionAssignee = {
  id: string;
  action_item_id: string;
  member_id: string;
  member_name_snapshot: string;
};

export type LeaderParticipantSnapshot = {
  id: string;
  member_id: string;
  member_name_snapshot: string;
};

export function getDiscussionStatusAfterMeeting(
  currentStatus: LeaderDiscussionStatus,
  outcome: LeaderMeetingTopicOutcome,
): LeaderDiscussionStatus {
  if (outcome === "resolved") return "resolved";
  if (outcome === "deferred") return "deferred";
  return currentStatus === "deferred" ? "deferred" : "pending";
}

export function createLeaderMeetingTopicSnapshot(item: {
  topic: string;
  notes: string | null;
}) {
  return {
    topicSnapshot: item.topic,
    sourceNotesSnapshot: item.notes,
  };
}

export function parseAssigneeMemberIds(value: unknown) {
  return parseUniqueMemberIds(value);
}

export function parseParticipantMemberIds(value: unknown) {
  return parseUniqueMemberIds(value);
}

function parseUniqueMemberIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false as const, reason: "required" as const, memberIds: [] };
  }

  if (value.some((memberId) => typeof memberId !== "string" || !memberId.trim())) {
    return { valid: false as const, reason: "invalid" as const, memberIds: [] };
  }

  const memberIds = value.map((memberId) => (memberId as string).trim());
  if (new Set(memberIds).size !== memberIds.length) {
    return { valid: false as const, reason: "duplicate" as const, memberIds: [] };
  }

  return { valid: true as const, memberIds };
}

export function haveParticipantOverlap(left: string[], right: string[]) {
  const rightIds = new Set(right);
  return left.some((memberId) => rightIds.has(memberId));
}

export function attachParticipantSnapshots<T extends { id: string }>(
  records: T[],
  participants: (LeaderParticipantSnapshot & { parent_id: string })[],
) {
  const participantsByParent = new Map<string, LeaderParticipantSnapshot[]>();
  for (const participant of participants) {
    const current = participantsByParent.get(participant.parent_id) ?? [];
    current.push({
      id: participant.id,
      member_id: participant.member_id,
      member_name_snapshot: participant.member_name_snapshot,
    });
    participantsByParent.set(participant.parent_id, current);
  }

  return records.map((record) => ({
    ...record,
    participants: participantsByParent.get(record.id) ?? [],
  }));
}

export function attachActionAssignees<T extends { id: string }>(
  actions: T[],
  assignees: LeaderMeetingActionAssignee[],
) {
  const assigneesByAction = new Map<string, LeaderMeetingActionAssignee[]>();
  for (const assignee of assignees) {
    const current = assigneesByAction.get(assignee.action_item_id) ?? [];
    current.push(assignee);
    assigneesByAction.set(assignee.action_item_id, current);
  }

  return actions.map((action) => ({
    ...action,
    assignees: assigneesByAction.get(action.id) ?? [],
  }));
}
