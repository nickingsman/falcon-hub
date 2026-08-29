import { NextResponse } from "next/server";
import {
  getConnectivityPointPayload,
  shapeConnectivityPoint,
  toConnectivityPointRow,
  validateConnectivityPointPayload,
} from "@/lib/project-comparison";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; pointId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, pointId } = await params;
    const body = await request.json();
    const payload = getConnectivityPointPayload(body);
    const validationError = validateConnectivityPointPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_connectivity_points")
      .update(toConnectivityPointRow(payload))
      .eq("id", pointId)
      .eq("project_id", id)
      .eq("is_deleted", false)
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

    return NextResponse.json(shapeConnectivityPoint(data, false));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/connectivity-points/[pointId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update connectivity point" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, pointId } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_connectivity_points")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", pointId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/connectivity-points/[pointId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete connectivity point" },
      { status: 500 },
    );
  }
}
