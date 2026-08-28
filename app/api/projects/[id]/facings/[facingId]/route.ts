import { NextResponse } from "next/server";
import {
  normalizeInteger,
  normalizeNullableText,
  projectMediaBucket,
} from "@/lib/project-content";
import {
  normalizeProjectFacingViewType,
  toFacingResponse,
  type ProjectFacingRow,
} from "@/lib/project-facings";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; facingId: string }>;
};

function getFacingPayload(body: Record<string, unknown>) {
  const viewType = normalizeProjectFacingViewType(body.view_type);

  return {
    name: normalizeNullableText(body.name),
    description: normalizeNullableText(body.description),
    media_id: normalizeNullableText(body.media_id),
    view_type: viewType,
    disclaimer: normalizeNullableText(body.disclaimer),
    sort_order: normalizeInteger(body.sort_order, 0),
  };
}

function validateFacingPayload(payload: ReturnType<typeof getFacingPayload>) {
  if (!payload.name) return "Facing / View Name is required";
  if (payload.view_type === undefined) return "View Type is invalid";
  if (!Number.isFinite(payload.sort_order)) return "Sort Order must be a whole number";

  return null;
}

async function validateFacingMedia(
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
    .eq("media_type", "facing_view")
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function softDeleteUnusedFacingMedia(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  mediaId: string | null,
  excludeFacingId: string,
) {
  if (!mediaId) return;

  const { count, error: referenceError } = await supabase
    .from("project_facings")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("media_id", mediaId)
    .eq("is_deleted", false)
    .neq("id", excludeFacingId);

  if (referenceError) {
    throw referenceError;
  }

  if ((count ?? 0) > 0) return;

  const { data } = await supabase
    .from("project_media")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", mediaId)
    .eq("project_id", projectId)
    .eq("media_type", "facing_view")
    .eq("is_deleted", false)
    .select("storage_path")
    .maybeSingle();

  if (data?.storage_path) {
    await supabase.storage.from(projectMediaBucket).remove([data.storage_path]);
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, facingId } = await params;
    const audience = new URL(request.url).searchParams.get("audience");
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("project_facings")
      .select(`
        id,
        project_id,
        name,
        description,
        media_id,
        view_type,
        disclaimer,
        sort_order,
        created_at,
        updated_at
      `)
      .eq("id", facingId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .single();

    if (error) {
      throw error;
    }

    const includeInternalMedia =
      audience === "customer" ? false : authorization.profile?.role === "super_admin" || authorization.profile?.role === "admin";

    return NextResponse.json(
      await toFacingResponse(supabase, data as ProjectFacingRow, includeInternalMedia),
    );
  } catch (error) {
    console.error("GET /api/projects/[id]/facings/[facingId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load facing" },
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
    const { id, facingId } = await params;
    const body = await request.json();
    const payload = getFacingPayload(body);
    const validationError = validateFacingPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: currentFacing, error: currentError } = await supabase
      .from("project_facings")
      .select("id, media_id")
      .eq("id", facingId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .single();

    if (currentError) {
      throw currentError;
    }

    if (!(await validateFacingMedia(supabase, id, payload.media_id))) {
      return NextResponse.json(
        { error: "Facing image must belong to this project" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("project_facings")
      .update(payload)
      .eq("id", facingId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select(`
        id,
        project_id,
        name,
        description,
        media_id,
        view_type,
        disclaimer,
        sort_order,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw error;
    }

    if (currentFacing.media_id && currentFacing.media_id !== payload.media_id) {
      await softDeleteUnusedFacingMedia(supabase, id, currentFacing.media_id, facingId);
    }

    return NextResponse.json(await toFacingResponse(supabase, data as ProjectFacingRow, true));
  } catch (error) {
    console.error("PATCH /api/projects/[id]/facings/[facingId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update facing" },
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
    const { id, facingId } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: facing, error: facingError } = await supabase
      .from("project_facings")
      .select("id, media_id")
      .eq("id", facingId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .single();

    if (facingError) {
      throw facingError;
    }

    const { count, error: referenceError } = await supabase
      .from("project_floor_plan_stacks")
      .select("id", { count: "exact", head: true })
      .eq("facing_id", facingId)
      .eq("is_deleted", false);

    if (referenceError) {
      throw referenceError;
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This Facing / View is still assigned to one or more Stack Mappings. Remove or reassign those mappings before deleting it.",
        },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("project_facings")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", facingId)
      .eq("project_id", id)
      .eq("is_deleted", false);

    if (error) {
      throw error;
    }

    await softDeleteUnusedFacingMedia(supabase, id, facing.media_id, facingId);

    return NextResponse.json({ id: facingId });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/facings/[facingId] error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete facing" },
      { status: 500 },
    );
  }
}
