import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";

export async function GET() {
  const access = await requireProjectApiReadAccess();
  if (!access.authorized) return access.response;
  try {
    const db = createSupabaseAdminClient();
    const [projects, coordinates] = await Promise.all([
      db.from("projects").select("id,project_name,developer,location,starting_price,tenure,status").eq("is_deleted", false),
      db.from("project_map_locations").select("project_id,latitude,longitude"),
    ]);
    if (projects.error) throw projects.error;
    if (coordinates.error) throw coordinates.error;
    const byId = new Map((coordinates.data ?? []).map((point) => [point.project_id, point]));
    return NextResponse.json((projects.data ?? []).map((project) => ({
      ...project,
      latitude: byId.get(project.id)?.latitude ?? null,
      longitude: byId.get(project.id)?.longitude ?? null,
    })));
  } catch (error) {
    console.error("GET project map error", error);
    return NextResponse.json({ error: "Unable to load project map. Verify the map migration has been applied." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const access = await requireProjectApiWriteAccess();
  if (!access.authorized) return access.response;
  try {
    const body = await request.json();
    const projectId = body.project_id;
    const latitude = body.latitude;
    const longitude = body.longitude;
    if (typeof projectId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId) ||
        typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid project or coordinates" }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    const { data: project, error: lookupError } = await db.from("projects").select("id").eq("id", projectId).eq("is_deleted", false).maybeSingle();
    if (lookupError) throw lookupError;
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const { error } = await db.from("project_map_locations").upsert({ project_id: projectId, latitude, longitude, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT project map error", error);
    return NextResponse.json({ error: "Unable to save coordinates" }, { status: 500 });
  }
}
