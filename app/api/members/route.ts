import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  console.log("========== POST /api/members HIT ==========");

  try {
    const payload = await request.json();

    console.log("Incoming Payload:");
    console.log(payload);

    const serviceRoleValue = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    console.log(
      "[api/members] SERVICE_ROLE_KEY present:",
      Boolean(serviceRoleValue),
      "redacted:",
      serviceRoleValue
        ? `${serviceRoleValue.slice(0, 8)}...`
        : "MISSING",
    );

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .insert([payload])
      .select("*");

    console.log("========== INSERT RESULT ==========");
    console.log("DATA:");
    console.dir(data, { depth: null });

    console.log("ERROR:");
    console.dir(error, { depth: null });

    if (error) {
      console.error("Supabase insert failed:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    console.log("Insert Success!");

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("========== POST CRASH ==========");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Error",
      },
      { status: 500 }
    );
  }
}