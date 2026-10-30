import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { VID_COOKIE, vidSchema } from "@/lib/counter-api";

// Next 16 renamed middleware.ts to proxy.ts. It runs only on the counter APIs
// and /admin, so public pages never pass through it and stay static (spec §3.1).

const ONE_YEAR = 60 * 60 * 24 * 365;
const SIGN_IN = "/admin/sign-in";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) return adminGate(request);
  return visitorCookie(request);
}

/**
 * Optimistic only: no session cookie means no admin, so skip rendering and go
 * to sign-in. A cookie is not trusted here; the admin layout and every admin
 * action and route re-check the session with requireAdmin().
 */
function adminGate(request: NextRequest) {
  if (request.nextUrl.pathname === SIGN_IN || getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL(SIGN_IN, request.url));
}

function visitorCookie(request: NextRequest) {
  if (vidSchema.safeParse(request.cookies.get(VID_COOKIE)?.value).success) {
    return NextResponse.next();
  }

  const vid = crypto.randomUUID();
  // Forward the new cookie on this request too, so a first-visit like counts.
  request.cookies.set(VID_COOKIE, vid);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set({
    name: VID_COOKIE,
    value: vid,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return response;
}

export const config = {
  matcher: ["/api/likes/:path*", "/api/views/:path*", "/admin/:path*"],
};
