import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseSsrClient } from "@/lib/supabase-ssr";
import {
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
  passwordRecoveryMaxAgeSeconds,
} from "@/lib/password-recovery";

function resetPasswordRedirect(request: NextRequest) {
  return new URL("/reset-password", request.url);
}

function invalidRecoveryRedirect(request: NextRequest) {
  const response = NextResponse.redirect(resetPasswordRedirect(request));
  response.cookies.set({
    name: passwordRecoveryCookieName,
    value: "",
    ...passwordRecoveryCookieOptions,
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const redirectUrl = resetPasswordRedirect(request);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return invalidRecoveryRedirect(request);
  }

  try {
    const supabase = await createSupabaseSsrClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return invalidRecoveryRedirect(request);
    }

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: passwordRecoveryCookieName,
      value: "1",
      ...passwordRecoveryCookieOptions,
      maxAge: passwordRecoveryMaxAgeSeconds,
    });
    return response;
  } catch {
    return invalidRecoveryRedirect(request);
  }
}
