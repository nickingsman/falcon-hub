import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
} from "@/lib/project-content";
import {
  normalizeTowerCode,
  toFloorPlanResponse,
  type FloorPlanRow,
} from "@/lib/project-floor-plans";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; floorPlanId: string }>;
};

type FloorPlanPayload = {
  name: string | null;
  tower_code: string | null;
  media_id: string | null;
  floor_from: number;
  floor_to: number;
  sort_order: number;
};

function getFloorPlanPayload(body: Record<string, unknown>): FloorPlanPayload {
  return {
    name: normalizeNullableText(body.name),
    tower_code: normalizeTowerCode(normalizeNullableText(body.tower_code)),
    media_id: normalizeNullableText(body.media_id),
    floor_from: normalizeInteger(body.floor_from, Number.NaN),
    floor_to: normalizeInteger(body.floor_to, Number.NaN),
    sort_order: normalizeInteger(body.sort_order, 0),
  };
}

function validateFloorPlanPayload(payload: FloorPlanPayload) {
  if (!payload.name) return "Floor Plan Name is required";
  if (!payload.media_id) return "Floor Plan image is required";
  if (!Number.isFinite(payload.floor_from) || payload.floor_from <= 0) {
    return "Floor From must be a positive whole number";
  }
  if (!Number.isFinite(payload.floor_to) || payload.floor_to <= 0) {
    return "Floor To must be a positive whole number";
  }
  if (payload.floor_from > payload.floor_to) {
    return "Floor From must be less than or equal to Floor To";
  }
  if (!Number.isFinite(payload.sort_order)) {
    return "Sort Order must be a whole number";
  }

  return null;
}

async function validateFloorPlanMedia(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  mediaId: string,
) {
  const { data, error } = await supabase
    .from("project_media")
    .select("id")
    .eq("id", mediaId)
    .eq("project_id", projectId)
    .eq("media_type", "floor_plan")
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function hasOverlappingFloorRange(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  payload: FloorPlanPayload,
  excludeFloorPlanId: string,
) {
  const { data, error } = await supabase
    .from("project_floor_plans")
    .select("id, tower_code")
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .lte("floor_from", payload.floor_to)
    .gte("floor_to", payload.floor_from)
    .neq("id", excludeFloorPlanId);

  if (error) {
    throw error;
  }

  return (data ?? []).some(
    (floorPlan) => normalizeTowerCode(floorPlan.tower_code) === payload.tower_code,
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, floorPlanId } = await params;
    const body = await request.json();
    const payload = getFloorPlanPayload(body);
    const validationError = validateFloorPlanPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await validateFloorPlanMedia(supabase, id, payload.media_id as string))) {
      return NextResponse.json(
        { error: "Floor Plan media must belong to this project" },
        { status: 400 },
      );
    }

    if (await hasOverlappingFloorRange(supabase, id, payload, floorPlanId)) {
      return NextResponse.json(
        { error: "Floor Plan floor range overlaps another active Floor Plan for this Tower/Block" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_floor_plans")
      .update({
        name: payload.name,
        tower_code: payload.tower_code,
        media_id: payload.media_id,
        floor_from: payload.floor_from,
        floor_to: payload.floor_to,
        sort_order: payload.sort_order,
      })
      .eq("id", floorPlanId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select(`
        id,
        project_id,
        name,
        tower_code,
        media_id,
        floor_from,
        floor_to,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(await toFloorPlanResponse(supabase, data as FloorPlanRow, true));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/floor-plans/[floorPlanId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update floor plan" },
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
    const { id, floorPlanId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_floor_plans")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", floorPlanId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    const { error: stackError } = await supabase
      .from("project_floor_plan_stacks")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("floor_plan_id", floorPlanId)
      .eq("is_deleted", false);

    if (stackError) {
      throw stackError;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/floor-plans/[floorPlanId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete floor plan" },
      { status: 500 },
    );
  }
}
