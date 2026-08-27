import { NextResponse } from "next/server";
import {
  canViewInternalProjectMedia,
  normalizeInteger,
  normalizeNullableText,
  projectExists,
  suggestDisplayConfiguration,
  type ProjectMediaRow,
  toProjectMediaResponse,
} from "@/lib/project-content";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UnitTypeRow = {
  id: string;
  project_id: string;
  type_code: string;
  type_name: string | null;
  bedrooms: number | null;
  additional_rooms: number;
  bathrooms: number | null;
  display_configuration: string | null;
  size_sqft: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
  layout_media_id: string | null;
  furnishing_package_id: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

async function getFurnishingPackage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  packageId: string | null,
) {
  if (!packageId) return null;

  const { data: furnishingPackage, error: packageError } = await supabase
    .from("project_furnishing_packages")
    .select("id, project_id, package_name, description, sort_order, created_at, updated_at")
    .eq("id", packageId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (packageError) {
    throw packageError;
  }

  if (!furnishingPackage) return null;

  const { data: items, error: itemError } = await supabase
    .from("project_furnishing_items")
    .select("id, package_id, item_name, quantity, description, sort_order, created_at, updated_at")
    .eq("package_id", packageId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemError) {
    throw itemError;
  }

  return {
    ...furnishingPackage,
    items: items ?? [],
  };
}

async function getLayoutMedia(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  mediaId: string | null,
  includeInternal: boolean,
) {
  if (!mediaId) return null;

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
    .eq("media_type", "unit_layout")
    .eq("is_deleted", false);

  if (!includeInternal) {
    query.eq("visibility", "customer");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return toProjectMediaResponse(supabase, data as ProjectMediaRow | null);
}

async function toUnitTypeResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  unitType: UnitTypeRow,
  includeInternalMedia: boolean,
) {
  const [layout, furnishingPackage] = await Promise.all([
    getLayoutMedia(supabase, unitType.layout_media_id, includeInternalMedia),
    getFurnishingPackage(supabase, unitType.furnishing_package_id),
  ]);

  return {
    id: unitType.id,
    project_id: unitType.project_id,
    type_code: unitType.type_code,
    type_name: unitType.type_name,
    bedrooms: unitType.bedrooms,
    additional_rooms: unitType.additional_rooms,
    bathrooms: unitType.bathrooms,
    display_configuration: unitType.display_configuration,
    size_sqft: unitType.size_sqft,
    default_carparks: unitType.default_carparks,
    carpark_description: unitType.carpark_description,
    layout_media_id: includeInternalMedia || layout ? unitType.layout_media_id : null,
    furnishing_package_id: unitType.furnishing_package_id,
    sort_order: unitType.sort_order,
    created_at: unitType.created_at,
    updated_at: unitType.updated_at,
    layout,
    furnishing_package: furnishingPackage,
  };
}

async function validateLayoutMedia(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  mediaId: string | null,
) {
  if (!mediaId) return true;

  const { data, error } = await supabase
    .from("project_media")
    .select("id")
    .eq("id", mediaId)
    .eq("project_id", projectId)
    .eq("media_type", "unit_layout")
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function validateFurnishingPackage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  packageId: string | null,
) {
  if (!packageId) return true;

  const { data, error } = await supabase
    .from("project_furnishing_packages")
    .select("id")
    .eq("id", packageId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function getUnitTypePayload(body: Record<string, unknown>) {
  const typeCode = normalizeNullableText(body.type_code);
  const bedrooms = normalizeInteger(body.bedrooms, Number.NaN);
  const additionalRooms = normalizeInteger(body.additional_rooms, 0);
  const bathrooms = normalizeInteger(body.bathrooms, Number.NaN);
  const sizeSqft = normalizeInteger(body.size_sqft, Number.NaN);
  const defaultCarparks = normalizeInteger(body.default_carparks, Number.NaN);
  const sortOrder = normalizeInteger(body.sort_order, 0);
  const normalizedBedrooms = Number.isFinite(bedrooms) ? bedrooms : null;
  const normalizedBathrooms = Number.isFinite(bathrooms) ? bathrooms : null;
  const displayConfiguration =
    normalizeNullableText(body.display_configuration) ||
    suggestDisplayConfiguration({
      bedrooms: normalizedBedrooms,
      additionalRooms,
      bathrooms: normalizedBathrooms,
    }) ||
    null;

  return {
    type_code: typeCode,
    type_name: normalizeNullableText(body.type_name),
    bedrooms: normalizedBedrooms,
    additional_rooms: additionalRooms,
    bathrooms: normalizedBathrooms,
    display_configuration: displayConfiguration,
    size_sqft: Number.isFinite(sizeSqft) ? sizeSqft : null,
    default_carparks: Number.isFinite(defaultCarparks) ? defaultCarparks : null,
    carpark_description: normalizeNullableText(body.carpark_description),
    layout_media_id: normalizeNullableText(body.layout_media_id),
    furnishing_package_id: normalizeNullableText(body.furnishing_package_id),
    sort_order: sortOrder,
  };
}

function validateUnitTypePayload(payload: ReturnType<typeof getUnitTypePayload>) {
  if (!payload.type_code) return "Type Code is required";
  if (!Number.isFinite(payload.additional_rooms) || payload.additional_rooms < 0) {
    return "Additional Rooms must be a non-negative whole number";
  }
  if (payload.bedrooms !== null && payload.bedrooms < 0) {
    return "Bedrooms must be a non-negative whole number";
  }
  if (payload.bathrooms !== null && payload.bathrooms < 0) {
    return "Bathrooms must be a non-negative whole number";
  }
  if (payload.size_sqft !== null && payload.size_sqft <= 0) {
    return "Size must be more than 0 sqft";
  }
  if (payload.default_carparks !== null && payload.default_carparks < 0) {
    return "Default Carparks must be a non-negative whole number";
  }
  if (!Number.isFinite(payload.sort_order)) {
    return "Sort Order must be a whole number";
  }

  return null;
}

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_unit_types")
      .select(`
        id,
        project_id,
        type_code,
        type_name,
        bedrooms,
        additional_rooms,
        bathrooms,
        display_configuration,
        size_sqft,
        default_carparks,
        carpark_description,
        layout_media_id,
        furnishing_package_id,
        sort_order,
        created_at,
        updated_at
      `)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const includeInternalMedia =
      audience === "customer" ? false : canViewInternalProjectMedia(authorization.profile);
    const response = await Promise.all(
      ((data ?? []) as UnitTypeRow[]).map((unitType) =>
        toUnitTypeResponse(supabase, unitType, includeInternalMedia),
      ),
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/projects/[id]/unit-types error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load unit types" },
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
    const payload = getUnitTypePayload(body);
    const validationError = validateUnitTypePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!(await validateLayoutMedia(supabase, id, payload.layout_media_id))) {
      return NextResponse.json({ error: "Layout media must belong to this project" }, { status: 400 });
    }

    if (!(await validateFurnishingPackage(supabase, id, payload.furnishing_package_id))) {
      return NextResponse.json(
        { error: "Furnishing package must belong to this project" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("project_unit_types")
      .insert({
        project_id: id,
        ...payload,
        is_deleted: false,
      })
      .select(`
        id,
        project_id,
        type_code,
        type_name,
        bedrooms,
        additional_rooms,
        bathrooms,
        display_configuration,
        size_sqft,
        default_carparks,
        carpark_description,
        layout_media_id,
        furnishing_package_id,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      await toUnitTypeResponse(supabase, data as UnitTypeRow, true),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/unit-types error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create unit type" },
      { status: 500 },
    );
  }
}
