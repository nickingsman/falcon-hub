import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  requireProjectApiReadAccess,
  requireProjectApiWriteAccess,
} from "@/lib/permissions";
import { normalizeNullableNumber } from "@/lib/project-comparison";
import { isUnitNumberFormat } from "@/lib/unit-number-format";
import { isCanonicalValue, maintenanceCalculationBases, maintenanceFeeTypes, ownershipTitleTypes, projectCategories } from "@/lib/project-property";

function canonicalOrNull<T extends readonly string[]>(value: unknown, values: T) {
  if (value === null || value === undefined || value === "") return null;
  return isCanonicalValue(value, values) ? value : undefined;
}

function normalizeProjectUnitNumberFormat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  return isUnitNumberFormat(value) ? value : undefined;
}

function normalizeEstimatedVpPart(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function validateEstimatedVp(year: number | null, quarter: number | null) {
  if (year === null && quarter === null) return null;
  if (year === null || quarter === null) return "Estimated VP requires both Year and Quarter";
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return "Estimated VP Year must be a valid year";
  }
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return "Estimated VP Quarter must be Q1, Q2, Q3, or Q4";
  }

  return null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        created_at,
        project_name,
        developer,
        location,
        property_type,
        property_category,
        tenure,
        title_type,
        ownership_title_type,
        starting_price,
        total_units,
        estimated_vp_year,
        estimated_vp_quarter,
        maintenance_fee_per_sqft,
        maintenance_fee_type,
        maintenance_fee_fixed_monthly,
        maintenance_calculation_basis,
        contact_role,
        contact_name,
        contact_phone,
        status,
        launch_date,
        unit_number_format,
        notes,
        is_deleted
      `)
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load project",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const unitNumberFormat = normalizeProjectUnitNumberFormat(body.unit_number_format);
    const hasEstimatedVpYear = Object.hasOwn(body, "estimated_vp_year");
    const hasEstimatedVpQuarter = Object.hasOwn(body, "estimated_vp_quarter");
    const hasEstimatedVp = hasEstimatedVpYear || hasEstimatedVpQuarter;
    const hasMaintenanceFeePerSqft = Object.hasOwn(body, "maintenance_fee_per_sqft");
    const estimatedVpYear = hasEstimatedVp
      ? normalizeEstimatedVpPart(body.estimated_vp_year)
      : null;
    const estimatedVpQuarter = hasEstimatedVp
      ? normalizeEstimatedVpPart(body.estimated_vp_quarter)
      : null;
    const maintenanceFeePerSqft = hasMaintenanceFeePerSqft
      ? normalizeNullableNumber(body.maintenance_fee_per_sqft)
      : null;
    const hasPropertyCategory = Object.hasOwn(body, "property_category");
    const hasOwnershipTitleType = Object.hasOwn(body, "ownership_title_type");
    const hasMaintenanceConfiguration = Object.hasOwn(body, "maintenance_fee_type");
    const propertyCategory = hasPropertyCategory ? canonicalOrNull(body.property_category, projectCategories) : null;
    const ownershipTitleType = hasOwnershipTitleType ? canonicalOrNull(body.ownership_title_type, ownershipTitleTypes) : null;
    const maintenanceFeeType = hasMaintenanceConfiguration ? canonicalOrNull(body.maintenance_fee_type, maintenanceFeeTypes) : null;
    const maintenanceCalculationBasis = hasMaintenanceConfiguration ? canonicalOrNull(body.maintenance_calculation_basis, maintenanceCalculationBases) : null;
    const maintenanceFeeFixedMonthly = hasMaintenanceConfiguration ? normalizeNullableNumber(body.maintenance_fee_fixed_monthly) : null;

    if (propertyCategory === undefined || ownershipTitleType === undefined || maintenanceFeeType === undefined || maintenanceCalculationBasis === undefined) {
      return NextResponse.json({ error: "Invalid Project classification or maintenance configuration" }, { status: 400 });
    }

    if (unitNumberFormat === undefined) {
      return NextResponse.json(
        { error: "Invalid Unit Number Format" },
        { status: 400 },
      );
    }

    if (Number.isNaN(estimatedVpYear) || Number.isNaN(estimatedVpQuarter)) {
      return NextResponse.json(
        { error: "Estimated VP must use valid Year and Quarter values" },
        { status: 400 },
      );
    }

    const estimatedVpError = validateEstimatedVp(estimatedVpYear, estimatedVpQuarter);

    if (estimatedVpError) {
      return NextResponse.json({ error: estimatedVpError }, { status: 400 });
    }

    if (
      maintenanceFeePerSqft !== null &&
      (!Number.isFinite(maintenanceFeePerSqft) || maintenanceFeePerSqft < 0)
    ) {
      return NextResponse.json(
        { error: "Maintenance Fee Per Sqft must be a non-negative number" },
        { status: 400 },
      );
    }
    if (maintenanceFeeFixedMonthly !== null && (!Number.isFinite(maintenanceFeeFixedMonthly) || maintenanceFeeFixedMonthly < 0)) {
      return NextResponse.json({ error: "Fixed Monthly Maintenance must be non-negative" }, { status: 400 });
    }
    if (hasMaintenanceConfiguration && maintenanceFeeType === "per_sqft" && (maintenanceFeePerSqft === null || maintenanceCalculationBasis === null)) {
      return NextResponse.json({ error: "Per Sqft maintenance requires a rate and calculation basis" }, { status: 400 });
    }
    if (hasMaintenanceConfiguration && maintenanceFeeType === "fixed" && maintenanceFeeFixedMonthly === null) {
      return NextResponse.json({ error: "Fixed maintenance requires a monthly amount" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const payload = {
      project_name: body.project_name,
      developer: body.developer || null,
      location: body.location || null,
      property_type: body.property_type || null,
      ...(hasPropertyCategory ? { property_category: propertyCategory } : {}),
      tenure: body.tenure || null,
      title_type: body.title_type || null,
      ...(hasOwnershipTitleType ? { ownership_title_type: ownershipTitleType } : {}),
      starting_price: body.starting_price
        ? Number(body.starting_price)
        : null,
      total_units: body.total_units
        ? Number(body.total_units)
        : null,
      status: body.status || "Active",
      launch_date: body.launch_date || null,
      unit_number_format: unitNumberFormat,
      notes: body.notes || null,
      contact_role: body.contact_role?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      contact_phone: body.contact_phone?.trim() || null,
      ...(hasEstimatedVp
        ? {
            estimated_vp_year: estimatedVpYear,
            estimated_vp_quarter: estimatedVpQuarter,
          }
        : {}),
      ...(hasMaintenanceFeePerSqft
        ? { maintenance_fee_per_sqft: maintenanceFeePerSqft }
        : {}),
      ...(hasMaintenanceConfiguration ? {
        maintenance_fee_type: maintenanceFeeType,
        maintenance_fee_fixed_monthly: maintenanceFeeType === "fixed" ? maintenanceFeeFixedMonthly : null,
        maintenance_calculation_basis: maintenanceFeeType === "per_sqft" ? maintenanceCalculationBasis : null,
      } : {}),
    };

    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update project",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .update({
        is_deleted: true,
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete project",
      },
      { status: 500 }
    );
  }
}
