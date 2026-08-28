import { NextResponse } from "next/server";
import {
  canViewInternalProjectMedia,
  normalizeInteger,
  normalizeNullableText,
} from "@/lib/project-content";
import { getFacingSummaries } from "@/lib/project-facings";
import {
  getUnitTypeSummaries,
  stackCodesConflict,
  validateCoordinatePayload,
  type FloorPlanStackPayload,
  type FloorPlanStackRow,
} from "@/lib/project-floor-plans";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; floorPlanId: string }>;
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
    facing_id: normalizeNullableText(body.facing_id),
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

async function facingBelongsToProject(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  facingId: string | null,
) {
  if (!facingId) return true;

  const { data, error } = await supabase
    .from("project_facings")
    .select("id")
    .eq("id", facingId)
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
  excludeStackId?: string,
) {
  let query = supabase
    .from("project_floor_plan_stacks")
    .select("id, stack_code")
    .eq("floor_plan_id", floorPlanId)
    .eq("is_deleted", false);

  if (excludeStackId) {
    query = query.neq("id", excludeStackId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).some((stack) => stackCodesConflict(stack.stack_code, stackCode));
}

async function toStackResponses(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  stacks: FloorPlanStackRow[],
  includeInternalMedia: boolean,
) {
  const unitTypeIds = stacks
    .map((stack) => stack.unit_type_id)
    .filter((id): id is string => Boolean(id));
  const facingIds = stacks
    .map((stack) => stack.facing_id)
    .filter((id): id is string => Boolean(id));
  const [unitTypes, facings] = await Promise.all([
    getUnitTypeSummaries(supabase, unitTypeIds),
    getFacingSummaries(supabase, facingIds, includeInternalMedia),
  ]);

  return stacks.map((stack) => ({
    ...stack,
    unit_type: stack.unit_type_id ? unitTypes.get(stack.unit_type_id) ?? null : null,
    facing: stack.facing_id ? facings.get(stack.facing_id) ?? null : null,
  }));
}

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, floorPlanId } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const supabase = createSupabaseAdminClient();

    if (!(await floorPlanBelongsToProject(supabase, id, floorPlanId))) {
      return NextResponse.json({ error: "Floor Plan not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("project_floor_plan_stacks")
      .select(`
        id,
        floor_plan_id,
        stack_code,
        unit_type_id,
        facing_id,
        x_percent,
        y_percent,
        width_percent,
        height_percent,
        sort_order,
        created_at,
        updated_at
      `)
      .eq("floor_plan_id", floorPlanId)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const includeInternalMedia =
      audience === "customer" ? false : canViewInternalProjectMedia(authorization.profile);

    return NextResponse.json(
      await toStackResponses(supabase, data as FloorPlanStackRow[], includeInternalMedia),
    );
  } catch (error) {
    console.error("GET /api/projects/[id]/floor-plans/[floorPlanId]/stacks error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load stack mappings" },
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
    const { id, floorPlanId } = await params;
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

    if (!(await facingBelongsToProject(supabase, id, payload.facing_id))) {
      return NextResponse.json(
        { error: "Facing / View must belong to this project" },
        { status: 400 },
      );
    }

    if (await hasDuplicateStackCode(supabase, floorPlanId, payload.stack_code)) {
      return NextResponse.json(
        { error: "Stack Code already exists for this Floor Plan" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_floor_plan_stacks")
      .insert({
        floor_plan_id: floorPlanId,
        stack_code: payload.stack_code.trim(),
        unit_type_id: payload.unit_type_id,
        facing_id: payload.facing_id,
        x_percent: payload.x_percent,
        y_percent: payload.y_percent,
        width_percent: payload.width_percent,
        height_percent: payload.height_percent,
        sort_order: payload.sort_order,
        is_deleted: false,
      })
      .select(`
        id,
        floor_plan_id,
        stack_code,
        unit_type_id,
        facing_id,
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

    const [response] = await toStackResponses(supabase, [data as FloorPlanStackRow], true);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/floor-plans/[floorPlanId]/stacks error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create stack mapping" },
      { status: 500 },
    );
  }
}
