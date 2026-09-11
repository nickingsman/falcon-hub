import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  welcomeHandoffCookieName,
  welcomeHandoffHeaderName,
} from "@/lib/welcome-handoff";

const publicRoutes = ["/login", "/register"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const { pathname } = request.nextUrl;
  const hasWelcomeHandoff = request.cookies.get(welcomeHandoffCookieName)?.value === "1";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(welcomeHandoffHeaderName);
  if (pathname === "/welcome" && hasWelcomeHandoff) {
    requestHeaders.set(welcomeHandoffHeaderName, "1");
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    if (hasWelcomeHandoff) {
      redirectResponse.cookies.set({
        name: welcomeHandoffCookieName,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }
    return redirectResponse;
  }

  if (user && isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/welcome" && hasWelcomeHandoff) {
    response.cookies.set({
      name: welcomeHandoffCookieName,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
