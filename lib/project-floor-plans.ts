import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectMediaRow } from "@/lib/project-content";
import { toProjectMediaResponse } from "@/lib/project-content";
import {
  normalizeStackCodeForMatching,
  normalizeTowerCode,
  stackCodesMatch,
} from "@/lib/unit-number-format";

export type FloorPlanRow = {
  id: string;
  project_id: string;
  name: string;
  tower_code: string | null;
  media_id: string;
  floor_from: number;
  floor_to: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type FloorPlanStackRow = {
  id: string;
  floor_plan_id: string;
  stack_code: string;
  unit_type_id: string | null;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type UnitTypeSummaryRow = {
  id: string;
  type_code: string;
  type_name: string | null;
  display_configuration: string | null;
};

export type FloorPlanStackPayload = {
  stack_code: string;
  unit_type_id: string | null;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  sort_order: number;
};

export function stackCodesConflict(left: string, right: string) {
  return stackCodesMatch(left, right);
}

export { normalizeStackCodeForMatching, normalizeTowerCode };

export function validateCoordinatePayload(payload: FloorPlanStackPayload) {
  const values = [
    payload.x_percent,
    payload.y_percent,
    payload.width_percent,
    payload.height_percent,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    return "Stack coordinates are required";
  }

  if (payload.x_percent < 0 || payload.x_percent > 100) {
    return "X position must be between 0 and 100";
  }

  if (payload.y_percent < 0 || payload.y_percent > 100) {
    return "Y position must be between 0 and 100";
  }

  if (payload.width_percent <= 0 || payload.height_percent <= 0) {
    return "Stack rectangle must have width and height";
  }

  if (payload.x_percent + payload.width_percent > 100) {
    return "Stack rectangle cannot extend beyond the floor plan width";
  }

  if (payload.y_percent + payload.height_percent > 100) {
    return "Stack rectangle cannot extend beyond the floor plan height";
  }

  return null;
}

export async function getFloorPlanMedia(
  supabase: SupabaseClient,
  mediaId: string,
  includeInternalMedia: boolean,
) {
  const query = supabase
    .from("project_media")
    .select(`
      id,
      project_id,
      title,
      media_type,
      storage_bucket,
      storage_path,
      mime_type,
      file_size_bytes,
      description,
      visibility,
      sort_order,
      created_at,
      updated_at
    `)
    .eq("id", mediaId)
    .eq("media_type", "floor_plan")
    .eq("is_deleted", false);

  if (!includeInternalMedia) {
    query.eq("visibility", "customer");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return toProjectMediaResponse(supabase, data as ProjectMediaRow | null);
}

export async function getFloorPlanStacks(
  supabase: SupabaseClient,
  floorPlanId: string,
) {
  const { data, error } = await supabase
    .from("project_floor_plan_stacks")
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
    .eq("floor_plan_id", floorPlanId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as FloorPlanStackRow[];
}

export async function getUnitTypeSummaries(
  supabase: SupabaseClient,
  unitTypeIds: string[],
) {
  if (unitTypeIds.length === 0) return new Map<string, UnitTypeSummaryRow>();

  const { data, error } = await supabase
    .from("project_unit_types")
    .select("id, type_code, type_name, display_configuration")
    .in("id", unitTypeIds)
    .eq("is_deleted", false);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as UnitTypeSummaryRow[]).map((unitType) => [unitType.id, unitType]),
  );
}

export async function toFloorPlanResponse(
  supabase: SupabaseClient,
  floorPlan: FloorPlanRow,
  includeInternalMedia: boolean,
  includeStacks = true,
) {
  const [media, stacks] = await Promise.all([
    getFloorPlanMedia(supabase, floorPlan.media_id, includeInternalMedia),
    includeStacks ? getFloorPlanStacks(supabase, floorPlan.id) : Promise.resolve([]),
  ]);
  const unitTypeIds = stacks
    .map((stack) => stack.unit_type_id)
    .filter((id): id is string => Boolean(id));
  const unitTypes = await getUnitTypeSummaries(supabase, unitTypeIds);

  return {
    id: floorPlan.id,
    project_id: floorPlan.project_id,
    name: floorPlan.name,
    tower_code: floorPlan.tower_code,
    media_id: includeInternalMedia || media ? floorPlan.media_id : null,
    floor_from: floorPlan.floor_from,
    floor_to: floorPlan.floor_to,
    sort_order: floorPlan.sort_order,
    created_at: floorPlan.created_at,
    updated_at: floorPlan.updated_at,
    media,
    stacks: stacks.map((stack) => ({
      ...stack,
      unit_type: stack.unit_type_id ? unitTypes.get(stack.unit_type_id) ?? null : null,
    })),
  };
}
