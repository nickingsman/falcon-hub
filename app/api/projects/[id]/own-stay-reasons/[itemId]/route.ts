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
      .from("project_own_stay_reasons")
      .update({
        title: body.title,
        explanation: body.explanation || null,
        how_to_sell: body.how_to_sell || null,
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
    console.error("PATCH /api/projects/[id]/own-stay-reasons/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update own stay reason",
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
      .from("project_own_stay_reasons")
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
    console.error("DELETE /api/projects/[id]/own-stay-reasons/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete own stay reason",
      },
      { status: 500 }
    );
  }
}
