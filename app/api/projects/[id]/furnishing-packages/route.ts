import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
  parseFurnishingItems,
  projectExists,
} from "@/lib/project-content";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getPackagesWithItems(supabase: ReturnType<typeof createSupabaseAdminClient>, projectId: string) {
  const { data: packages, error: packageError } = await supabase
    .from("project_furnishing_packages")
    .select("id, project_id, package_name, description, sort_order, created_at, updated_at")
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (packageError) {
    throw packageError;
  }

  const packageIds = (packages ?? []).map((item) => item.id);
  const { data: items, error: itemError } = packageIds.length
    ? await supabase
        .from("project_furnishing_items")
        .select("id, package_id, item_name, quantity, description, sort_order, created_at, updated_at")
        .in("package_id", packageIds)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (itemError) {
    throw itemError;
  }

  return (packages ?? []).map((item) => ({
    ...item,
    items: (items ?? []).filter((child) => child.package_id === item.id),
  }));
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    return NextResponse.json(await getPackagesWithItems(supabase, id));
  } catch (error) {
    console.error("GET /api/projects/[id]/furnishing-packages error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load furnishing packages" },
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

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: furnishingPackage, error } = await supabase
      .from("project_furnishing_packages")
      .insert({
        project_id: id,
        package_name: packageName,
        description: normalizeNullableText(body.description),
        sort_order: sortOrder,
        is_deleted: false,
      })
      .select("id, project_id, package_name, description, sort_order, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase.from("project_furnishing_items").insert(
        items.map((item) => ({
          ...item,
          package_id: furnishingPackage.id,
        })),
      );

      if (itemError) {
        throw itemError;
      }
    }

    const responsePackage = (await getPackagesWithItems(supabase, id)).find(
      (item) => item.id === furnishingPackage.id,
    );

    return NextResponse.json(responsePackage ?? furnishingPackage, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/furnishing-packages error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create furnishing package" },
      { status: 500 },
    );
  }
}
