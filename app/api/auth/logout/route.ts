import { NextRequest, NextResponse } from "next/server";
import { isTrustedPushServiceEndpoint } from "@/lib/push-subscriptions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import { welcomeHandoffCookieName } from "@/lib/welcome-handoff";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseSsrClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let pushSubscriptionEndpoint: unknown;
  try {
    pushSubscriptionEndpoint = (await request.json() as {
      pushSubscriptionEndpoint?: unknown;
    }).pushSubscriptionEndpoint;
  } catch {
    return NextResponse.json({ error: "Invalid logout request" }, { status: 400 });
  }

  if (
    pushSubscriptionEndpoint !== null &&
    (typeof pushSubscriptionEndpoint !== "string" ||
      !isTrustedPushServiceEndpoint(pushSubscriptionEndpoint))
  ) {
    return NextResponse.json({ error: "Invalid logout request" }, { status: 400 });
  }

  if (typeof pushSubscriptionEndpoint === "string") {
    const adminSupabase = createSupabaseAdminClient();
    const { error: cleanupError } = await adminSupabase
      .from("push_subscriptions")
      .delete()
      .eq("auth_user_id", userData.user.id)
      .eq("endpoint", pushSubscriptionEndpoint);

    if (cleanupError) {
      return NextResponse.json(
        { error: "Unable to safely disable notifications before logout" },
        { status: 500 },
      );
    }
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    return NextResponse.json({ error: "Unable to sign out" }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: welcomeHandoffCookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
