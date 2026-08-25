import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET() {
  try {
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
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/projects error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load projects",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .insert({
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
        is_deleted: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create project",
      },
      { status: 500 }
    );
  }
}