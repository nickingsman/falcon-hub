import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update member",
      },
      { status: 500 }
    );
  }
}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
  .from("users")
  .update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  })
  .eq("id", id);
  if (error) {
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  );
}
return NextResponse.json(
  { message: "Member deleted successfully." },
  { status: 200 }
);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete member",
      },
      { status: 500 }
    );
  }
}

