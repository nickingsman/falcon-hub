import { NextResponse } from "next/server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import { welcomeHandoffCookieName } from "@/lib/welcome-handoff";

export async function POST() {
  const supabase = await createSupabaseSsrClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: welcomeHandoffCookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
