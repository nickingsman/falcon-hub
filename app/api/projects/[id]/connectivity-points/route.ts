import { NextResponse } from "next/server";
import {
  getConnectivityPointPayload,
  shapeConnectivityPoint,
  toConnectivityPointRow,
  validateConnectivityPointPayload,
} from "@/lib/project-comparison";
import { projectExists } from "@/lib/project-content";
import { canManageProjects, requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const customerSafe = audience === "customer" || !canManageProjects(authorization.profile);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_connectivity_points")
      .select(`
        id,
        project_id,
        category,
        name,
        distance_meters,
        connection_mode,
        customer_description,
        internal_note,
        sort_order,
        created_at,
        updated_at
      `)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json((data ?? []).map((point) => shapeConnectivityPoint(point, customerSafe)));
  } catch (error) {
    console.error("GET /api/projects/[id]/connectivity-points error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load connectivity points" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const payload = getConnectivityPointPayload(body);
    const validationError = validateConnectivityPointPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("project_connectivity_points")
      .insert({
        project_id: id,
        ...toConnectivityPointRow(payload),
        is_deleted: false,
      })
      .select(`
        id,
        project_id,
        category,
        name,
        distance_meters,
        connection_mode,
        customer_description,
        internal_note,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(shapeConnectivityPoint(data, false), { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/connectivity-points error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create connectivity point" },
      { status: 500 },
    );
  }
}
