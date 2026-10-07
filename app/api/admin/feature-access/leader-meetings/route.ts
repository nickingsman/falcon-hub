import { NextResponse } from "next/server";
import { leaderMeetingsFeatureKey } from "@/lib/feature-access";
import { requireLeaderMeetingsAccessManagement } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const authorization = await requireLeaderMeetingsAccessManagement();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.authUserId !== "string" || !uuidPattern.test(body.authUserId)) {
      return NextResponse.json({ error: "Falcon Hub account is invalid" }, { status: 400 });
    }
    if (typeof body.isEnabled !== "boolean") {
      return NextResponse.json({ error: "Feature access state is required" }, { status: 400 });
    }
    const supabase = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("auth_user_id, status")
      .eq("auth_user_id", body.authUserId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Falcon Hub account not found" }, { status: 404 });
    if (body.isEnabled && profile.status !== "active") {
      return NextResponse.json({ error: "Only an active account can receive feature access" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = body.isEnabled
      ? await supabase.from("user_feature_access").upsert({ auth_user_id: body.authUserId, feature_key: leaderMeetingsFeatureKey, is_enabled: true, granted_at: now, granted_by: authorization.user.id, revoked_at: null, revoked_by: null }, { onConflict: "auth_user_id,feature_key" })
      : await supabase.from("user_feature_access").upsert({ auth_user_id: body.authUserId, feature_key: leaderMeetingsFeatureKey, is_enabled: false, revoked_at: now, revoked_by: authorization.user.id }, { onConflict: "auth_user_id,feature_key" });
    if (error) throw error;
    return NextResponse.json({ authUserId: body.authUserId, isEnabled: body.isEnabled });
  } catch (error) {
    console.error("PATCH Leader Meetings feature access failed", error);
    return NextResponse.json({ error: "Unable to update Leader Meetings access" }, { status: 500 });
  }
}
