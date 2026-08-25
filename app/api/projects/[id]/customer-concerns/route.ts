import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_customer_concerns")
      .select(`
        id,
        project_id,
        title,
        customer_concern,
        real_issue,
        analysis,
        suggested_counter,
        supporting_data,
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

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/projects/[id]/customer-concerns error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load customer concerns",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("project_customer_concerns")
      .insert({
        project_id: id,
        title: body.title,
        customer_concern: body.customer_concern || null,
        real_issue: body.real_issue || null,
        analysis: body.analysis || null,
        suggested_counter: body.suggested_counter || null,
        supporting_data: body.supporting_data || null,
        sort_order: body.sort_order ? Number(body.sort_order) : 0,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/customer-concerns error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create customer concern",
      },
      { status: 500 }
    );
  }
}
