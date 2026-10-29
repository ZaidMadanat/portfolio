import { NextResponse, type NextRequest } from "next/server";
import { VID_COOKIE, vidSchema } from "@/lib/counter-api";

// Next 16 renamed middleware.ts to proxy.ts. This runs only on the counter APIs,
// so public pages never pass through it and stay static (spec §3.1).
// Better Auth adds its /admin matcher here later (Task 17).

const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
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
  matcher: ["/api/likes/:path*", "/api/views/:path*"],
};
