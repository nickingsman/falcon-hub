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
      .from("project_customer_concerns")
      .update({
        title: body.title,
        customer_concern: body.customer_concern || null,
        real_issue: body.real_issue || null,
        analysis: body.analysis || null,
        suggested_counter: body.suggested_counter || null,
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
    console.error("PATCH /api/projects/[id]/customer-concerns/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update customer concern",
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
      .from("project_customer_concerns")
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
    console.error("DELETE /api/projects/[id]/customer-concerns/[itemId] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete customer concern",
      },
      { status: 500 }
    );
  }
}
