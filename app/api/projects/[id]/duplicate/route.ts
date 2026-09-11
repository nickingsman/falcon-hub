import { NextResponse } from "next/server";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { getDuplicateName } from "@/lib/project-duplication";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = { params: Promise<{ id: string }> };
type DuplicateKind = "unit_type" | "sales_package" | "furnishing_package" | "floor_plan" | "facing";

const copyFields = <T extends Record<string, unknown>>(row: T, excluded: string[]) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !excluded.includes(key)));

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();
  if (!authorization.authorized) return authorization.response;

  const { id: projectId } = await params;
  const body = await request.json() as { kind?: DuplicateKind; recordId?: string };
  const supabase = createSupabaseAdminClient();

  try {
    if (!body.kind || !body.recordId) {
      return NextResponse.json({ error: "Duplicate target is required" }, { status: 400 });
    }

    if (body.kind === "unit_type") {
      const { data: source, error } = await supabase.from("project_unit_types").select("*").eq("id", body.recordId).eq("project_id", projectId).eq("is_deleted", false).single();
      if (error) throw error;
      const { data: siblings, error: siblingsError } = await supabase.from("project_unit_types").select("type_code").eq("project_id", projectId).eq("is_deleted", false);
      if (siblingsError) throw siblingsError;
      const duplicate = {
        ...copyFields(source, ["id", "created_at", "updated_at", "deleted_at"]),
        type_code: getDuplicateName(source.type_code, (siblings ?? []).map((item) => item.type_code)),
        furnishing_package_id: null,
      };
      const { data, error: insertError } = await supabase.from("project_unit_types").insert(duplicate).select("id").single();
      if (insertError) throw insertError;
      return NextResponse.json(data, { status: 201 });
    }

    if (body.kind === "facing") {
      const { data: source, error } = await supabase.from("project_facings").select("*").eq("id", body.recordId).eq("project_id", projectId).eq("is_deleted", false).single();
      if (error) throw error;
      const { data: siblings, error: siblingsError } = await supabase.from("project_facings").select("name").eq("project_id", projectId).eq("is_deleted", false);
      if (siblingsError) throw siblingsError;
      const duplicate = {
        ...copyFields(source, ["id", "created_at", "updated_at", "deleted_at"]),
        name: getDuplicateName(source.name, (siblings ?? []).map((item) => item.name)),
      };
      const { data, error: insertError } = await supabase.from("project_facings").insert(duplicate).select("id").single();
      if (insertError) throw insertError;
      return NextResponse.json(data, { status: 201 });
    }

    if (body.kind === "furnishing_package") {
      const { data: source, error } = await supabase.from("project_furnishing_packages").select("*").eq("id", body.recordId).eq("project_id", projectId).eq("is_deleted", false).single();
      if (error) throw error;
      const [{ data: siblings, error: siblingsError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from("project_furnishing_packages").select("package_name").eq("project_id", projectId).eq("is_deleted", false),
        supabase.from("project_furnishing_items").select("*").eq("package_id", body.recordId).eq("is_deleted", false),
      ]);
      if (siblingsError) throw siblingsError;
      if (itemsError) throw itemsError;
      const { data: parent, error: parentError } = await supabase.from("project_furnishing_packages").insert({
        ...copyFields(source, ["id", "created_at", "updated_at", "deleted_at"]),
        package_name: getDuplicateName(source.package_name, (siblings ?? []).map((item) => item.package_name)),
      }).select("id").single();
      if (parentError) throw parentError;
      if (items?.length) {
        const { error: childError } = await supabase.from("project_furnishing_items").insert(items.map((item) => ({
          ...copyFields(item, ["id", "package_id", "created_at", "updated_at", "deleted_at"]), package_id: parent.id,
        })));
        if (childError) {
          await supabase.from("project_furnishing_packages").delete().eq("id", parent.id);
          throw childError;
        }
      }
      return NextResponse.json(parent, { status: 201 });
    }

    if (body.kind === "floor_plan") {
      const { data: source, error } = await supabase.from("project_floor_plans").select("*").eq("id", body.recordId).eq("project_id", projectId).eq("is_deleted", false).single();
      if (error) throw error;
      const [{ data: siblings, error: siblingsError }, { data: stacks, error: stacksError }] = await Promise.all([
        supabase.from("project_floor_plans").select("name").eq("project_id", projectId).eq("is_deleted", false),
        supabase.from("project_floor_plan_stacks").select("*").eq("floor_plan_id", body.recordId).eq("is_deleted", false),
      ]);
      if (siblingsError) throw siblingsError;
      if (stacksError) throw stacksError;
      const { data: parent, error: parentError } = await supabase.from("project_floor_plans").insert({
        ...copyFields(source, ["id", "created_at", "updated_at", "deleted_at"]),
        name: getDuplicateName(source.name, (siblings ?? []).map((item) => item.name)),
      }).select("id").single();
      if (parentError) throw parentError;
      if (stacks?.length) {
        const { error: childError } = await supabase.from("project_floor_plan_stacks").insert(stacks.map((stack) => ({
          ...copyFields(stack, ["id", "floor_plan_id", "created_at", "updated_at", "deleted_at"]), floor_plan_id: parent.id,
        })));
        if (childError) {
          await supabase.from("project_floor_plans").delete().eq("id", parent.id);
          throw childError;
        }
      }
      return NextResponse.json(parent, { status: 201 });
    }

    const packageResult = await import("@/lib/project-comparison").then(({ getCommercialPackagesForProject }) => getCommercialPackagesForProject(supabase, projectId, false, body.recordId));
    const packageData = Array.isArray(packageResult)
      ? packageResult.find((item) => item.id === body.recordId)
      : packageResult;
    if (!packageData) return NextResponse.json({ error: "Sales Package not found" }, { status: 404 });
    const { data: siblings, error: siblingsError } = await supabase.from("project_commercial_packages").select("package_name").eq("project_id", projectId).eq("is_deleted", false);
    if (siblingsError) throw siblingsError;
    const { data, error } = await supabase.rpc("save_project_commercial_package", {
      p_project_id: projectId,
      p_package_id: null,
      p_package_name: getDuplicateName(packageData.package_name, (siblings ?? []).map((item) => item.package_name)),
      p_customer_description: packageData.customer_description,
      p_internal_note: packageData.internal_note,
      p_valid_from: packageData.valid_from,
      p_valid_until: packageData.valid_until,
      p_applies_to_all_unit_types: true,
      p_furnishing_package_id: null,
      p_sort_order: packageData.sort_order,
      p_unit_type_ids: [],
      p_items: packageData.items.map((item) => copyFields(item, ["id", "package_id", "created_at", "updated_at"])),
      p_purchase_costs: packageData.purchase_costs.map((item) => copyFields(item, ["id", "package_id", "created_at", "updated_at"])),
    });
    if (error) throw error;
    return NextResponse.json(data?.[0] ?? {}, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/duplicate error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to duplicate record" }, { status: 500 });
  }
}
