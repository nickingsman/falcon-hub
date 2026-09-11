import { NextResponse } from "next/server";
import { getAuthenticatedUserProfile } from "@/lib/auth";
import {
  welcomeHandoffCookieName,
  welcomeHandoffMaxAgeSeconds,
} from "@/lib/welcome-handoff";

export async function POST() {
  const authContext = await getAuthenticatedUserProfile();

  if (!authContext) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (authContext.profile?.status !== "active") {
    return NextResponse.json({ error: "Active account required" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: welcomeHandoffCookieName,
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: welcomeHandoffMaxAgeSeconds,
    path: "/",
  });
  return response;
}
