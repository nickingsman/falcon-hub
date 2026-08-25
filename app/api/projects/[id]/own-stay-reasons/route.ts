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
      .from("project_own_stay_reasons")
      .select(`
        id,
        project_id,
        title,
        explanation,
        how_to_sell,
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
    console.error("GET /api/projects/[id]/own-stay-reasons error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load own stay reasons",
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
      .from("project_own_stay_reasons")
      .insert({
        project_id: id,
        title: body.title,
        explanation: body.explanation || null,
        how_to_sell: body.how_to_sell || null,
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
    console.error("POST /api/projects/[id]/own-stay-reasons error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create own stay reason",
      },
      { status: 500 }
    );
  }
}
