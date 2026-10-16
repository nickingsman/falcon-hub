import { NextResponse } from "next/server";
import { getLeaderPromotionCandidates } from "@/lib/leader-promotions";
import { requireLeaderPromotionManagement } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getMemberDisplayName } from "@/lib/member-display";

export const dynamic = "force-dynamic";

async function fetchAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await load(offset, offset + 999);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function GET() {
  const authorization = await requireLeaderPromotionManagement();
  if (!authorization.authorized) return authorization.response;

  try {
    const supabase = createSupabaseAdminClient();
    const [members, profiles, requests] = await Promise.all([
      fetchAll((from, to) => supabase.from("users")
        .select("id, member_code, full_name, display_name, leader_id, status, is_deleted")
        .range(from, to)),
      fetchAll((from, to) => supabase.from("user_profiles")
        .select("auth_user_id, member_id, role, status").range(from, to)),
      fetchAll((from, to) => supabase.from("leader_promotion_requests")
        .select("id, member_id, agent_auth_user_id, status, direct_downline_count, total_downline_count, created_at, decided_at, decided_by, decision_note")
        .order("created_at", { ascending: false }).range(from, to)),
    ]);

    const membersById = new Map(members.map((member) => [member.id, member]));
    const candidates = getLeaderPromotionCandidates(members, profiles, requests);

    return NextResponse.json({
      pendingCount: requests.filter((request) => request.status === "pending").length,
      requests: requests.map((request) => {
        const member = membersById.get(request.member_id);
        return {
          ...request,
          agentName: member ? getMemberDisplayName(member) : "Unknown member",
          memberCode: member?.member_code ?? null,
          currentRole: profiles.find((profile) => profile.auth_user_id === request.agent_auth_user_id)?.role ?? null,
        };
      }),
      backfillPreview: candidates.map((candidate) => {
        const member = membersById.get(candidate.memberId);
        return {
          ...candidate,
          agentName: member ? getMemberDisplayName(member) : "Unknown member",
          memberCode: member?.member_code ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/admin/leader-promotions error:", error);
    return NextResponse.json({ error: "Unable to load Leader Promotion Requests" }, { status: 500 });
  }
}
