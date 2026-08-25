import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id, itemId } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_resources")
      .update({
        resource_name: body.resource_name,
        resource_type: body.resource_type || "Other",
        description: body.description || null,
        external_link: body.external_link || null,
        visibility: body.visibility || "internal",
        sort_order: body.sort_order ? Number(body.sort_order) : 0,
      })
      .eq("id", itemId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/projects/[id]/resources/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update project resource",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id, itemId } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_resources")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("project_id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id]/resources/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete project resource",
      },
      { status: 500 }
    );
  }
}
