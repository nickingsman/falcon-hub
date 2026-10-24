import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";

const validCoordinate = (latitude: unknown, longitude: unknown) =>
  typeof latitude === "number" && typeof longitude === "number" &&
  Number.isFinite(latitude) && Number.isFinite(longitude) &&
  latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

// Existing projects remain the source of truth. Map positions are optional metadata.
export async function GET() {
  const access = await requireProjectApiReadAccess();
  if (!access.authorized) return access.response;
  try {
    const db = createSupabaseAdminClient();
    const { data: projects, error } = await db.from("projects")
      .select("id,project_name,developer,location,starting_price,tenure,status")
      .eq("is_deleted", false);
    if (error) throw error;
    const { data: positions, error: positionError } = await db
      .from("project_map_locations").select("project_id,latitude,longitude");
    // Before migration, show existing projects without pins rather than invent coordinates.
    if (positionError && positionError.code !== "42P01" && positionError.code !== "PGRST205") {
      console.error("Project map positions unavailable", positionError);
    }
    const byId = new Map((positions ?? []).map(p => [p.project_id, p]));
    return NextResponse.json((projects ?? []).map(project => ({
      ...project,
      latitude: byId.get(project.id)?.latitude ?? null,
      longitude: byId.get(project.id)?.longitude ?? null,
      can_edit_map: access.profile?.role === "admin" || access.profile?.role === "super_admin",
    })));
  } catch (error) {
    console.error("GET project map error", error);
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireProjectApiWriteAccess();
  if (!access.authorized) return access.response;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { project_id, latitude, longitude } = body as Record<string, unknown>;
  if (typeof project_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(project_id) ||
      !validCoordinate(latitude, longitude)) {
    return NextResponse.json({ error: "Valid project ID and coordinates required" }, { status: 400 });
  }
  try {
    const db = createSupabaseAdminClient();
    const { data: project, error: lookupError } = await db.from("projects")
      .select("id").eq("id", project_id).eq("is_deleted", false).maybeSingle();
    if (lookupError) throw lookupError;
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const { error } = await db.from("project_map_locations").upsert({
      project_id, latitude, longitude, updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" });
    if (error) throw error;
    return NextResponse.json({ project_id, latitude, longitude });
  } catch (error) {
    console.error("PUT project map error", error);
    return NextResponse.json({ error: "Unable to save project location. Verify the map migration is installed." }, { status: 500 });
  }
}
