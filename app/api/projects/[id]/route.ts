import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        created_at,
        project_name,
        developer,
        location,
        property_type,
        tenure,
        title_type,
        starting_price,
        total_units,
        status,
        launch_date,
        notes,
        is_deleted
      `)
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load project",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .update({
        project_name: body.project_name,
        developer: body.developer || null,
        location: body.location || null,
        property_type: body.property_type || null,
        tenure: body.tenure || null,
        title_type: body.title_type || null,
        starting_price: body.starting_price
          ? Number(body.starting_price)
          : null,
        total_units: body.total_units
          ? Number(body.total_units)
          : null,
        status: body.status || "Active",
        launch_date: body.launch_date || null,
        notes: body.notes || null,
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update project",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .update({
        is_deleted: true,
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete project",
      },
      { status: 500 }
    );
  }
}