import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
} from "@/lib/project-content";
import {
  getUnitTypeSummaries,
  stackCodesConflict,
  validateCoordinatePayload,
  type FloorPlanStackPayload,
  type FloorPlanStackRow,
} from "@/lib/project-floor-plans";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; floorPlanId: string; stackId: string }>;
};

function normalizeDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return Number.NaN;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getStackPayload(body: Record<string, unknown>): FloorPlanStackPayload {
  return {
    stack_code: normalizeNullableText(body.stack_code) || "",
    unit_type_id: normalizeNullableText(body.unit_type_id),
    x_percent: normalizeDecimal(body.x_percent),
    y_percent: normalizeDecimal(body.y_percent),
    width_percent: normalizeDecimal(body.width_percent),
    height_percent: normalizeDecimal(body.height_percent),
    sort_order: normalizeInteger(body.sort_order, 0),
  };
}

function validateStackPayload(payload: FloorPlanStackPayload) {
  if (!payload.stack_code.trim()) return "Stack Code is required";
  if (!Number.isFinite(payload.sort_order)) return "Sort Order must be a whole number";

  return validateCoordinatePayload(payload);
}

async function floorPlanBelongsToProject(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  floorPlanId: string,
) {
  const { data, error } = await supabase
    .from("project_floor_plans")
    .select("id")
    .eq("id", floorPlanId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function unitTypeBelongsToProject(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  unitTypeId: string | null,
) {
  if (!unitTypeId) return true;

  const { data, error } = await supabase
    .from("project_unit_types")
    .select("id")
    .eq("id", unitTypeId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function hasDuplicateStackCode(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  floorPlanId: string,
  stackCode: string,
  excludeStackId: string,
) {
  const { data, error } = await supabase
    .from("project_floor_plan_stacks")
    .select("id, stack_code")
    .eq("floor_plan_id", floorPlanId)
    .eq("is_deleted", false)
    .neq("id", excludeStackId);

  if (error) {
    throw error;
  }

  return (data ?? []).some((stack) => stackCodesConflict(stack.stack_code, stackCode));
}

async function toStackResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  stack: FloorPlanStackRow,
) {
  const unitTypes = await getUnitTypeSummaries(
    supabase,
    stack.unit_type_id ? [stack.unit_type_id] : [],
  );

  return {
    ...stack,
    unit_type: stack.unit_type_id ? unitTypes.get(stack.unit_type_id) ?? null : null,
  };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, floorPlanId, stackId } = await params;
    const body = await request.json();
    const payload = getStackPayload(body);
    const validationError = validateStackPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await floorPlanBelongsToProject(supabase, id, floorPlanId))) {
      return NextResponse.json({ error: "Floor Plan not found" }, { status: 404 });
    }

    if (!(await unitTypeBelongsToProject(supabase, id, payload.unit_type_id))) {
      return NextResponse.json(
        { error: "Unit Type must belong to this project" },
        { status: 400 },
      );
    }

    if (await hasDuplicateStackCode(supabase, floorPlanId, payload.stack_code, stackId)) {
      return NextResponse.json(
        { error: "Stack Code already exists for this Floor Plan" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_floor_plan_stacks")
      .update({
        stack_code: payload.stack_code.trim(),
        unit_type_id: payload.unit_type_id,
        x_percent: payload.x_percent,
        y_percent: payload.y_percent,
        width_percent: payload.width_percent,
        height_percent: payload.height_percent,
        sort_order: payload.sort_order,
      })
      .eq("id", stackId)
      .eq("floor_plan_id", floorPlanId)
      .eq("is_deleted", false)
      .select(`
        id,
        floor_plan_id,
        stack_code,
        unit_type_id,
        x_percent,
        y_percent,
        width_percent,
        height_percent,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(await toStackResponse(supabase, data as FloorPlanStackRow));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/floor-plans/[floorPlanId]/stacks/[stackId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update stack mapping" },
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
    const { id, floorPlanId, stackId } = await params;
    const supabase = createSupabaseAdminClient();

    if (!(await floorPlanBelongsToProject(supabase, id, floorPlanId))) {
      return NextResponse.json({ error: "Floor Plan not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("project_floor_plan_stacks")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", stackId)
      .eq("floor_plan_id", floorPlanId)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/floor-plans/[floorPlanId]/stacks/[stackId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete stack mapping" },
      { status: 500 },
    );
  }
}
