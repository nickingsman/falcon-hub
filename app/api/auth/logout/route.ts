import { NextResponse } from "next/server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

export async function POST() {
  const supabase = await createSupabaseSsrClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
