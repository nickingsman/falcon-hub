import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  requireProjectApiReadAccess,
  requireProjectApiWriteAccess,
} from "@/lib/permissions";
import { normalizeNullableDate, normalizeNullableNumber } from "@/lib/project-comparison";
import { isUnitNumberFormat } from "@/lib/unit-number-format";

function normalizeProjectUnitNumberFormat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  return isUnitNumberFormat(value) ? value : undefined;
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
        tenure,
        title_type,
        starting_price,
        total_units,
        estimated_vp_date,
        maintenance_fee_per_sqft,
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
    const hasEstimatedVpDate = Object.hasOwn(body, "estimated_vp_date");
    const hasMaintenanceFeePerSqft = Object.hasOwn(body, "maintenance_fee_per_sqft");
    const estimatedVpDate = hasEstimatedVpDate
      ? normalizeNullableDate(body.estimated_vp_date)
      : null;
    const maintenanceFeePerSqft = hasMaintenanceFeePerSqft
      ? normalizeNullableNumber(body.maintenance_fee_per_sqft)
      : null;

    if (unitNumberFormat === undefined) {
      return NextResponse.json(
        { error: "Invalid Unit Number Format" },
        { status: 400 },
      );
    }

    if (estimatedVpDate === undefined) {
      return NextResponse.json(
        { error: "Estimated VP Date must be a valid date" },
        { status: 400 },
      );
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

    const supabase = createSupabaseAdminClient();
    const payload = {
      project_name: body.project_name,
      developer: body.developer || null,
      location: body.location || null,
      property_type: body.property_type || null,
      tenure: body.tenure || null,
      title_type: body.title_type || null,
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
      ...(hasEstimatedVpDate ? { estimated_vp_date: estimatedVpDate } : {}),
      ...(hasMaintenanceFeePerSqft
        ? { maintenance_fee_per_sqft: maintenanceFeePerSqft }
        : {}),
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
