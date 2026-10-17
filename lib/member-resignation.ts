import type { HierarchyMember } from "./member-hierarchy";

export type DownlineReassignment = {
  memberId: string;
  leaderId: string | null;
};

export function getActiveDirectDownlines<T extends HierarchyMember>(
  members: T[],
  leaderId: string,
) {
  return members.filter(
    (member) => member.leader_id === leaderId && member.status === "Active",
  );
}

export function parseDownlineReassignments(value: unknown): DownlineReassignment[] {
  if (!Array.isArray(value)) {
    throw new Error("Downline reassignments must be a list");
  }

  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Downline reassignment is invalid");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.memberId !== "string" || !record.memberId.trim()) {
      throw new Error("Downline member is required");
    }
    const memberId = record.memberId.trim();
    if (seen.has(memberId)) {
      throw new Error("Each downline member can only be reassigned once");
    }
    seen.add(memberId);

    if (record.leaderId !== null && typeof record.leaderId !== "string") {
      throw new Error("Replacement leader is invalid");
    }
    const leaderId = typeof record.leaderId === "string"
      ? record.leaderId.trim() || null
      : null;
    return { memberId, leaderId };
  });
}

export function toResignationRpcAssignments(assignments: DownlineReassignment[]) {
  return assignments.map((assignment) => ({
    member_id: assignment.memberId,
    leader_id: assignment.leaderId,
  }));
}
