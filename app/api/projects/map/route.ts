import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireProjectApiReadAccess } from "@/lib/permissions";

// Read-only preview: use existing projects; no migration or writes required.
export async function GET() {
  const access = await requireProjectApiReadAccess();
  if (!access.authorized) return access.response;
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from("projects")
      .select("id,project_name,developer,location,starting_price,tenure,status")
      .eq("is_deleted", false);
    if (error) throw error;
    return NextResponse.json((data ?? []).map(project => ({
      ...project, latitude: null, longitude: null,
    })));
  } catch (error) {
    console.error("GET project map error", error);
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}
