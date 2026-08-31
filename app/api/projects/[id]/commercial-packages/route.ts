import { NextResponse } from "next/server";
import {
  getCommercialPackagePayload,
  getCommercialPackagesForProject,
  validateCommercialPackagePayload,
  validateCommercialPackageRelationships,
} from "@/lib/project-comparison";
import { projectExists } from "@/lib/project-content";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const customerSafe = audience === "customer";
    const supabase = createSupabaseAdminClient();

    return NextResponse.json(await getCommercialPackagesForProject(supabase, id, customerSafe));
  } catch (error) {
    console.error("GET /api/projects/[id]/commercial-packages error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load sales packages" },
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
    const payload = getCommercialPackagePayload(body);
    const validationError = validateCommercialPackagePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const relationshipError = await validateCommercialPackageRelationships(supabase, id, payload);

    if (relationshipError) {
      return NextResponse.json({ error: relationshipError }, { status: 400 });
    }

    const { data: commercialPackages, error: packageError } = await supabase.rpc(
      "save_project_commercial_package",
      {
        p_project_id: id,
        p_package_id: null,
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

    const commercialPackage = commercialPackages?.[0];

    if (!commercialPackage) {
      throw new Error("Unable to create sales package");
    }

    return NextResponse.json(
      await getCommercialPackagesForProject(supabase, id, false, commercialPackage.package_id),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/commercial-packages error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create sales package" },
      { status: 500 },
    );
  }
}
