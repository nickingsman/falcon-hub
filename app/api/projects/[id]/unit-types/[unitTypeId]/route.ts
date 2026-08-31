import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
  projectMediaBucket,
  suggestDisplayConfiguration,
} from "@/lib/project-content";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import {
  getUnitTypeComparisonPayload,
  validateUnitTypeComparisonPayload,
  type UnitTypeComparisonFields,
} from "@/lib/project-comparison";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; unitTypeId: string }>;
};

const comparisonFieldKeys = [
  "spa_price_from",
  "spa_price_to",
  "price_from",
  "price_to",
  "estimated_rental_from",
  "estimated_rental_to",
  "has_balcony",
  "is_dual_key",
] as const;

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

  const comparisonPayload = getUnitTypeComparisonPayload(body);

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
    ...comparisonPayload,
    sort_order: sortOrder,
  };
}

function validateBaseUnitTypePayload(payload: ReturnType<typeof getUnitTypePayload>) {
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

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, unitTypeId } = await params;
    const body = await request.json();
    const payload = getUnitTypePayload(body);
    const validationError = validateBaseUnitTypePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: currentUnitType, error: currentError } = await supabase
      .from("project_unit_types")
      .select(`
        id,
        layout_media_id,
        spa_price_from,
        spa_price_to,
        price_from,
        price_to,
        estimated_rental_from,
        estimated_rental_to,
        has_balcony,
        is_dual_key
      `)
      .eq("id", unitTypeId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .single();

    if (currentError) {
      throw currentError;
    }

    const effectiveComparisonPayload: UnitTypeComparisonFields = {
      spa_price_from: Object.hasOwn(body, "spa_price_from")
        ? payload.spa_price_from
        : currentUnitType.spa_price_from,
      spa_price_to: Object.hasOwn(body, "spa_price_to")
        ? payload.spa_price_to
        : currentUnitType.spa_price_to,
      price_from: Object.hasOwn(body, "price_from")
        ? payload.price_from
        : currentUnitType.price_from,
      price_to: Object.hasOwn(body, "price_to") ? payload.price_to : currentUnitType.price_to,
      estimated_rental_from: Object.hasOwn(body, "estimated_rental_from")
        ? payload.estimated_rental_from
        : currentUnitType.estimated_rental_from,
      estimated_rental_to: Object.hasOwn(body, "estimated_rental_to")
        ? payload.estimated_rental_to
        : currentUnitType.estimated_rental_to,
      has_balcony: Object.hasOwn(body, "has_balcony")
        ? payload.has_balcony
        : currentUnitType.has_balcony,
      is_dual_key: Object.hasOwn(body, "is_dual_key")
        ? payload.is_dual_key
        : currentUnitType.is_dual_key,
    };
    const comparisonValidationError = validateUnitTypeComparisonPayload(effectiveComparisonPayload);

    if (comparisonValidationError) {
      return NextResponse.json({ error: comparisonValidationError }, { status: 400 });
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

    const updatePayload = { ...payload };
    for (const key of comparisonFieldKeys) {
      if (!Object.hasOwn(body, key)) {
        delete updatePayload[key];
      }
    }

    const { data, error } = await supabase
      .from("project_unit_types")
      .update(updatePayload)
      .eq("id", unitTypeId)
      .eq("project_id", id)
      .eq("is_deleted", false)
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
        spa_price_from,
        spa_price_to,
        price_from,
        price_to,
        estimated_rental_from,
        estimated_rental_to,
        has_balcony,
        is_dual_key,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    if (
      currentUnitType.layout_media_id &&
      currentUnitType.layout_media_id !== payload.layout_media_id
    ) {
      const { count: otherReferenceCount, error: referenceError } = await supabase
        .from("project_unit_types")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id)
        .eq("layout_media_id", currentUnitType.layout_media_id)
        .eq("is_deleted", false)
        .neq("id", unitTypeId);

      if (referenceError) {
        throw referenceError;
      }

      if ((otherReferenceCount ?? 0) === 0) {
        const { data: oldMedia } = await supabase
          .from("project_media")
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq("id", currentUnitType.layout_media_id)
          .eq("project_id", id)
          .eq("media_type", "unit_layout")
          .eq("is_deleted", false)
          .select("storage_path")
          .maybeSingle();

        if (oldMedia?.storage_path) {
          await supabase.storage.from(projectMediaBucket).remove([oldMedia.storage_path]);
        }
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/projects/[id]/unit-types/[unitTypeId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update unit type" },
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
    const { id, unitTypeId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_unit_types")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", unitTypeId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/unit-types/[unitTypeId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete unit type" },
      { status: 500 },
    );
  }
}
