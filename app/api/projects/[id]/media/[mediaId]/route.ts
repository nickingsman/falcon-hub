import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
  projectMediaBucket,
  type ProjectMediaRow,
  type ProjectMediaVisibility,
  toProjectMediaResponse,
} from "@/lib/project-content";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; mediaId: string }>;
};

function normalizeVisibility(value: unknown): ProjectMediaVisibility {
  return value === "internal" ? "internal" : "customer";
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, mediaId } = await params;
    const body = await request.json();
    const title = normalizeNullableText(body.title);
    const sortOrder = normalizeInteger(body.sort_order, 0);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Sort Order must be a whole number" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_media")
      .update({
        title,
        description: normalizeNullableText(body.description),
        visibility: normalizeVisibility(body.visibility),
        sort_order: sortOrder,
      })
      .eq("id", mediaId)
      .eq("project_id", id)
      .eq("is_deleted", false)
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
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(await toProjectMediaResponse(supabase, data as ProjectMediaRow));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/media/[mediaId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update project media" },
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
    const { id, mediaId } = await params;
    const supabase = createSupabaseAdminClient();

    const { error: mediaError } = await supabase
      .from("project_media")
      .select("id")
      .eq("id", mediaId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .single();

    if (mediaError) {
      throw mediaError;
    }

    const { count: unitTypeReferenceCount, error: referenceError } = await supabase
      .from("project_unit_types")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("layout_media_id", mediaId)
      .eq("is_deleted", false);

    if (referenceError) {
      throw referenceError;
    }

    if ((unitTypeReferenceCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "This media is currently used as a Unit Type layout." },
        { status: 409 },
      );
    }

    const { count: floorPlanReferenceCount, error: floorPlanReferenceError } = await supabase
      .from("project_floor_plans")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("media_id", mediaId)
      .eq("is_deleted", false);

    if (floorPlanReferenceError) {
      throw floorPlanReferenceError;
    }

    if ((floorPlanReferenceCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "This media is currently used as a Floor Plan." },
        { status: 409 },
      );
    }

    const { count: facingReferenceCount, error: facingReferenceError } = await supabase
      .from("project_facings")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("media_id", mediaId)
      .eq("is_deleted", false);

    if (facingReferenceError) {
      throw facingReferenceError;
    }

    if ((facingReferenceCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "This media is currently used as a Facing / View image." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_media")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", mediaId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select("id, storage_path")
      .single();

    if (error) {
      throw error;
    }

    if (data?.storage_path) {
      await supabase.storage.from(projectMediaBucket).remove([data.storage_path]);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/media/[mediaId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete project media" },
      { status: 500 },
    );
  }
}
