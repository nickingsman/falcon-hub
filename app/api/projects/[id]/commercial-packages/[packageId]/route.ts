import { NextResponse } from "next/server";
import {
  getCommercialPackagePayload,
  getCommercialPackagesForProject,
  validateCommercialPackagePayload,
  validateCommercialPackageRelationships,
} from "@/lib/project-comparison";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; packageId: string }>;
};

async function packageBelongsToProject(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  packageId: string,
) {
  const { data, error } = await supabase
    .from("project_commercial_packages")
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

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, packageId } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const customerSafe = audience === "customer";
    const supabase = createSupabaseAdminClient();
    const commercialPackage = await getCommercialPackagesForProject(
      supabase,
      id,
      customerSafe,
      packageId,
    );

    if (!commercialPackage) {
      return NextResponse.json({ error: "Commercial package not found" }, { status: 404 });
    }

    return NextResponse.json(commercialPackage);
  } catch (error) {
    console.error("GET /api/projects/[id]/commercial-packages/[packageId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load sales package" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, packageId } = await params;
    const body = await request.json();
    const payload = getCommercialPackagePayload(body);
    const validationError = validateCommercialPackagePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await packageBelongsToProject(supabase, id, packageId))) {
      return NextResponse.json({ error: "Commercial package not found" }, { status: 404 });
    }

    const relationshipError = await validateCommercialPackageRelationships(supabase, id, payload);

    if (relationshipError) {
      return NextResponse.json({ error: relationshipError }, { status: 400 });
    }

    const { data: commercialPackages, error: packageError } = await supabase.rpc(
      "save_project_commercial_package",
      {
        p_project_id: id,
        p_package_id: packageId,
        p_package_name: payload.package_name,
        p_customer_description: payload.customer_description,
        p_internal_note: payload.internal_note,
        p_valid_from: payload.valid_from,
        p_valid_until: payload.valid_until,
        p_applies_to_all_unit_types: payload.applies_to_all_unit_types,
        p_furnishing_package_id: payload.furnishing_package_id,
        p_sort_order: payload.sort_order,
        p_unit_type_ids: payload.applies_to_all_unit_types ? [] : payload.unit_type_ids,
        p_items: payload.items,
        p_purchase_costs: payload.purchase_costs,
      },
    );

    if (packageError) {
      throw packageError;
    }

    if (!commercialPackages?.[0]) {
      throw new Error("Unable to update sales package");
    }

    return NextResponse.json(await getCommercialPackagesForProject(supabase, id, false, packageId));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/commercial-packages/[packageId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update sales package" },
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
    const { id, packageId } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_commercial_packages")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", packageId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/commercial-packages/[packageId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete sales package" },
      { status: 500 },
    );
  }
}
