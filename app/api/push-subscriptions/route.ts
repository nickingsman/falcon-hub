import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  canUpdateExistingPushSubscription,
  getPushSubscriptionAccessFailure,
  isTrustedPushServiceEndpoint,
  validatePushSubscriptionPayload,
} from "@/lib/push-subscriptions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushAccessContext = {
  authUserId: string;
  memberId: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requirePushAccess(): Promise<
  | { authorized: true; context: PushAccessContext }
  | { authorized: false; response: NextResponse }
> {
  const authContext = await getAuthenticatedUserProfile();
  const accessFailure = getPushSubscriptionAccessFailure({
    authenticated: !!authContext,
    profileStatus: authContext?.profile?.status ?? null,
    memberId: authContext?.profile?.member_id ?? null,
  });

  if (accessFailure || !authContext?.profile?.member_id) {
    const failure = accessFailure ?? {
      status: 403,
      message: "Active linked member is required",
    };
    return { authorized: false, response: jsonError(failure.message, failure.status) };
  }

  const supabase = createSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", authContext.profile.member_id)
    .eq("status", "Active")
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    return { authorized: false, response: jsonError("Unable to verify notification access", 500) };
  }

  if (!member) {
    return { authorized: false, response: jsonError("Active linked member is required", 403) };
  }

  return {
    authorized: true,
    context: {
      authUserId: authContext.user.id,
      memberId: authContext.profile.member_id,
    },
  };
}

export async function GET(request: NextRequest) {
  const authorization = await requirePushAccess();
  if (!authorization.authorized) return authorization.response;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return jsonError("Push notifications are not configured", 503);

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (endpoint && !isTrustedPushServiceEndpoint(endpoint)) {
    return jsonError("Invalid subscription endpoint", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", authorization.context.authUserId)
    .eq("member_id", authorization.context.memberId);

  if (error) return jsonError("Unable to load notification settings", 500);

  let enabledForCurrentDevice = false;
  if (endpoint) {
    const { count: deviceCount, error: deviceError } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", authorization.context.authUserId)
      .eq("member_id", authorization.context.memberId)
      .eq("endpoint", endpoint);

    if (deviceError) return jsonError("Unable to load notification settings", 500);
    enabledForCurrentDevice = (deviceCount ?? 0) > 0;
  }

  return NextResponse.json({
    vapidPublicKey: publicKey,
    subscriptionCount: count ?? 0,
    enabledForCurrentDevice,
  });
}

export async function POST(request: NextRequest) {
  const authorization = await requirePushAccess();
  if (!authorization.authorized) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid subscription payload", 400);
  }

  const subscription = validatePushSubscriptionPayload(body);
  if (!subscription) return jsonError("Invalid subscription payload", 400);

  const supabase = createSupabaseAdminClient();
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  const { data: existing, error: existingError } = await supabase
    .from("push_subscriptions")
    .select("id, auth_user_id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();

  if (existingError) return jsonError("Unable to verify notification ownership", 500);

  if (
    !canUpdateExistingPushSubscription(
      existing?.auth_user_id ?? null,
      authorization.context.authUserId,
    )
  ) {
    return jsonError("This notification endpoint belongs to another device", 409);
  }

  const values = {
    auth_user_id: authorization.context.authUserId,
    member_id: authorization.context.memberId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth_key: subscription.keys.auth,
    expiration_time: subscription.expirationTime
      ? new Date(subscription.expirationTime).toISOString()
      : null,
    user_agent: userAgent,
    last_seen_at: new Date().toISOString(),
  };
  if (existing) {
    const { data: updated, error } = await supabase
      .from("push_subscriptions")
      .update(values)
      .eq("id", existing.id)
      .eq("auth_user_id", authorization.context.authUserId)
      .select("id")
      .maybeSingle();

    if (error) return jsonError("Unable to enable notifications", 500);
    if (!updated) return jsonError("Notification ownership changed; please try again", 409);
    return NextResponse.json({ enabled: true });
  }

  const { error } = await supabase.from("push_subscriptions").insert(values);

  if (error?.code === "23505") {
    return jsonError("Notification ownership changed; please try again", 409);
  }
  if (error) return jsonError("Unable to enable notifications", 500);
  return NextResponse.json({ enabled: true });
}

export async function DELETE(request: NextRequest) {
  const authorization = await requirePushAccess();
  if (!authorization.authorized) return authorization.response;

  let endpoint: unknown;
  try {
    endpoint = (await request.json() as { endpoint?: unknown }).endpoint;
  } catch {
    return jsonError("Notification endpoint is required", 400);
  }

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 4096
  ) {
    return jsonError("Notification endpoint is required", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("auth_user_id", authorization.context.authUserId)
    .eq("member_id", authorization.context.memberId)
    .eq("endpoint", endpoint);

  if (error) return jsonError("Unable to disable notifications", 500);
  return NextResponse.json({ enabled: false });
}
