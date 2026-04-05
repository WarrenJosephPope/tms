import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Supabase middleware — refreshes the session cookie on every request.
 * Must be called from middleware.js.
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not write code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicPaths = [
    "/",
    "/login",
    "/register",
    "/register/shipper",
    "/register/transporter",
    "/register/pending",
    "/auth/callback",
    "/auth/confirm",
  ];

  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith("/api/auth/")
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
