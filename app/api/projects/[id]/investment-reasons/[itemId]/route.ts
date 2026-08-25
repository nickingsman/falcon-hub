import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireProjectApiWriteAccess } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, itemId } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_investment_reasons")
      .update({
        title: body.title,
        investment_logic: body.investment_logic || null,
        how_to_sell: body.how_to_sell || null,
        supporting_data: body.supporting_data || null,
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
    console.error("PATCH /api/projects/[id]/investment-reasons/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update investment reason",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id, itemId } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_investment_reasons")
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
    console.error("DELETE /api/projects/[id]/investment-reasons/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete investment reason",
      },
      { status: 500 }
    );
  }
}
