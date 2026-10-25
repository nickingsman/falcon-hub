import { NextRequest, NextResponse } from "next/server";
import {
  isProjectMapConstructionStatus,
  type ProjectMapConstructionStatus,
} from "@/lib/project-map";
import {
  requireProjectApiReadAccess,
  requireProjectApiWriteAccess,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type MapPositionRow = {
  project_id: string;
  latitude: number;
  longitude: number;
  construction_status: ProjectMapConstructionStatus;
  confirmed_at: string;
};

function validCoordinate(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}

// Existing projects remain the source of truth. Map positions and construction
// status are optional, explicitly confirmed metadata.
export async function GET() {
  const access = await requireProjectApiReadAccess();
  if (!access.authorized) return access.response;

  try {
    const db = createSupabaseAdminClient();
    const [{ data: projects, error }, { data: positions, error: positionError }] =
      await Promise.all([
        db
          .from("projects")
          .select(
            "id,project_name,developer,location,starting_price,tenure,status",
          )
          .eq("is_deleted", false)
          .order("project_name"),
        db
          .from("project_map_locations")
          .select(
            "project_id,latitude,longitude,construction_status,confirmed_at",
          ),
      ]);

    if (error) throw error;

    // A missing map table must not hide existing projects. It keeps every
    // project visible as Location Pending until the reviewed migration exists.
    if (
      positionError &&
      positionError.code !== "42P01" &&
      positionError.code !== "PGRST205"
    ) {
      throw positionError;
    }

    const byId = new Map(
      ((positions ?? []) as MapPositionRow[]).map((position) => [
        position.project_id,
        position,
      ]),
    );
    const canEditMap =
      access.profile?.role === "admin" ||
      access.profile?.role === "super_admin";

    return NextResponse.json(
      (projects ?? []).map((project) => {
        const position = byId.get(project.id);

        return {
          ...project,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          construction_status:
            position &&
            isProjectMapConstructionStatus(position.construction_status)
              ? position.construction_status
              : null,
          confirmed_at: position?.confirmed_at ?? null,
          can_edit_map: canEditMap,
        };
      }),
    );
  } catch (error) {
    console.error("GET project map error", error);
    return NextResponse.json(
      { error: "Unable to load projects" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireProjectApiWriteAccess();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { project_id, latitude, longitude, construction_status } = body as Record<
    string,
    unknown
  >;

  if (
    typeof project_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(project_id) ||
    !validCoordinate(latitude, longitude) ||
    !isProjectMapConstructionStatus(construction_status)
  ) {
    return NextResponse.json(
      {
        error:
          "Valid project ID, coordinates, and construction status are required",
      },
      { status: 400 },
    );
  }

  try {
    const db = createSupabaseAdminClient();
    const { data: project, error: lookupError } = await db
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const { error } = await db.from("project_map_locations").upsert(
      {
        project_id,
        latitude,
        longitude,
        construction_status,
        confirmed_at: timestamp,
        confirmed_by: access.user.id,
        updated_at: timestamp,
        updated_by: access.user.id,
      },
      { onConflict: "project_id" },
    );

    if (error) throw error;

    return NextResponse.json({
      project_id,
      latitude,
      longitude,
      construction_status,
      confirmed_at: timestamp,
    });
  } catch (error) {
    console.error("PUT project map error", error);
    return NextResponse.json(
      {
        error:
          "Unable to save project location. Verify the Property Map migration is installed.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
