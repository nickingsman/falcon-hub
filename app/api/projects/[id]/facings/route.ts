import { NextResponse } from "next/server";
import {
  canViewInternalProjectMedia,
  normalizeInteger,
  normalizeNullableText,
  projectExists,
} from "@/lib/project-content";
import {
  normalizeProjectFacingViewType,
  toFacingResponse,
  type ProjectFacingRow,
} from "@/lib/project-facings";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
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

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
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
      .eq("project_id", id)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const includeInternalMedia =
      audience === "customer" ? false : canViewInternalProjectMedia(authorization.profile);
    const response = await Promise.all(
      ((data ?? []) as ProjectFacingRow[]).map((facing) =>
        toFacingResponse(supabase, facing, includeInternalMedia),
      ),
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/projects/[id]/facings error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load facings" },
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
    const payload = getFacingPayload(body);
    const validationError = validateFacingPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!(await validateFacingMedia(supabase, id, payload.media_id))) {
      return NextResponse.json(
        { error: "Facing image must belong to this project" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("project_facings")
      .insert({
        project_id: id,
        name: payload.name,
        description: payload.description,
        media_id: payload.media_id,
        view_type: payload.view_type,
        disclaimer: payload.disclaimer,
        sort_order: payload.sort_order,
        is_deleted: false,
      })
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

    return NextResponse.json(
      await toFacingResponse(supabase, data as ProjectFacingRow, true),
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/facings error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create facing" },
      { status: 500 },
    );
  }
}
