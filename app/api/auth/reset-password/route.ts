import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  minimumPasswordLength,
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";

function clearRecoveryCookie(response: NextResponse) {
  response.cookies.set({
    name: passwordRecoveryCookieName,
    value: "",
    ...passwordRecoveryCookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();

  if (cookieStore.get(passwordRecoveryCookieName)?.value !== "1") {
    return clearRecoveryCookie(
      NextResponse.json({ error: "This password reset link is invalid or has expired." }, { status: 401 }),
    );
  }

  let body: { password?: unknown; confirmPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Unable to update password." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (password.length < minimumPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at least ${minimumPasswordLength} characters.` },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const supabase = await createSupabaseSsrClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return clearRecoveryCookie(
      NextResponse.json({ error: "This password reset link is invalid or has expired." }, { status: 401 }),
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: "Unable to update password. Please request a new reset link and try again." }, { status: 400 });
  }

  await supabase.auth.signOut({ scope: "local" });
  return clearRecoveryCookie(NextResponse.json({ success: true }));
}
