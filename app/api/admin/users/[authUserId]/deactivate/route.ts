import { NextResponse } from "next/server";
import { requireAdminUserManagementAccess } from "@/lib/permissions";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

type RouteContext = {
  params: Promise<{ authUserId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await requireAdminUserManagementAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { authUserId } = await params;
    const supabase = await createSupabaseSsrClient();
    const { error } = await supabase.rpc("deactivate_falconhub_user", {
      p_target_auth_user_id: authUserId,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to deactivate Falcon Hub access";
    const code = "code" in Object(error) ? String(Object(error).code) : "";

    return NextResponse.json(
      { error: message },
      {
        status:
          code === "P0002"
            ? 404
            : code === "42501"
            ? 403
            : code === "23514"
              ? 409
              : code === "22P02"
                ? 400
                : 500,
      }
    );
  }
}
