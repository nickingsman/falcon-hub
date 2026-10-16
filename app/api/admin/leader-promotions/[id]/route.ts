import { NextResponse } from "next/server";
import { requireLeaderPromotionManagement } from "@/lib/permissions";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireLeaderPromotionManagement();
  if (!authorization.authorized) return authorization.response;

  try {
    const { id } = await params;
    const body = await request.json() as { decision?: unknown; note?: unknown };
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return NextResponse.json({ error: "Select Approve or Reject" }, { status: 400 });
    }
    const note = typeof body.note === "string" ? body.note.trim() || null : null;
    const supabase = await createSupabaseSsrClient();
    const { data, error } = await supabase.rpc("decide_leader_promotion_request", {
      p_request_id: id,
      p_decision: body.decision,
      p_note: note,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, result: data?.[0] ?? null });
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? "");
    const status = code === "42501" ? 403 : ["22023", "P0002", "40001"].includes(code) ? 409 : 500;
    return NextResponse.json({
      error: status === 500 ? "Unable to decide Leader Promotion Request" : error instanceof Error ? error.message : "Request could not be decided",
    }, { status });
  }
}
