import { NextResponse } from "next/server";
import { requireProjectApiReadAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, project_name, location")
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("project_name", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      (data ?? []).map((project) => ({
        id: project.id,
        name: project.project_name,
        location: project.location,
      })),
    );
  } catch (error) {
    console.error("GET /api/tools/project-comparison/projects error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load projects" },
      { status: 500 },
    );
  }
}
