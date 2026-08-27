import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
  parseFurnishingItems,
} from "@/lib/project-content";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
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

async function getPackageWithItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  packageId: string,
) {
  const { data: furnishingPackage, error: packageError } = await supabase
    .from("project_furnishing_packages")
    .select("id, project_id, package_name, description, sort_order, created_at, updated_at")
    .eq("id", packageId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .single();

  if (packageError) {
    throw packageError;
  }

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

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, packageId } = await params;
    const body = await request.json();
    const packageName = normalizeNullableText(body.package_name);
    const sortOrder = normalizeInteger(body.sort_order, 0);

    if (!packageName) {
      return NextResponse.json({ error: "Package Name is required" }, { status: 400 });
    }

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Sort Order must be a whole number" }, { status: 400 });
    }

    const items = parseFurnishingItems(body.items)
      .map((item, index) => ({
        package_id: packageId,
        item_name: normalizeNullableText(item.item_name),
        quantity: item.quantity === "" || item.quantity === null ? null : normalizeInteger(item.quantity, Number.NaN),
        description: normalizeNullableText(item.description),
        sort_order: normalizeInteger(item.sort_order, index),
        is_deleted: false,
      }))
      .filter((item) => item.item_name);

    if (items.some((item) => item.quantity !== null && (!Number.isFinite(item.quantity) || item.quantity <= 0))) {
      return NextResponse.json({ error: "Furnishing item quantities must be positive whole numbers" }, { status: 400 });
    }

    if (items.some((item) => !Number.isFinite(item.sort_order))) {
      return NextResponse.json({ error: "Furnishing item sort order must be a whole number" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await packageBelongsToProject(supabase, id, packageId))) {
      return NextResponse.json({ error: "Furnishing package not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("project_furnishing_packages")
      .update({
        package_name: packageName,
        description: normalizeNullableText(body.description),
        sort_order: sortOrder,
      })
      .eq("id", packageId)
      .eq("project_id", id)
      .eq("is_deleted", false);

    if (error) {
      throw error;
    }

    const { error: deleteItemError } = await supabase
      .from("project_furnishing_items")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("package_id", packageId)
      .eq("is_deleted", false);

    if (deleteItemError) {
      throw deleteItemError;
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase.from("project_furnishing_items").insert(items);

      if (itemError) {
        throw itemError;
      }
    }

    return NextResponse.json(await getPackageWithItems(supabase, id, packageId));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/furnishing-packages/[packageId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update furnishing package" },
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

    if (!(await packageBelongsToProject(supabase, id, packageId))) {
      return NextResponse.json({ error: "Furnishing package not found" }, { status: 404 });
    }

    const { error: unlinkError } = await supabase
      .from("project_unit_types")
      .update({ furnishing_package_id: null })
      .eq("project_id", id)
      .eq("furnishing_package_id", packageId)
      .eq("is_deleted", false);

    if (unlinkError) {
      throw unlinkError;
    }

    const { data, error } = await supabase
      .from("project_furnishing_packages")
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

    const { error: itemError } = await supabase
      .from("project_furnishing_items")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("package_id", packageId)
      .eq("is_deleted", false);

    if (itemError) {
      throw itemError;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/furnishing-packages/[packageId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete furnishing package" },
      { status: 500 },
    );
  }
}
