import { getAdmin } from "@/lib/require-admin";

// GET /api/admin/session → {admin: boolean}. Lets a static public page show
// admin-only hints (the Reviews hub's "Pick your top 4") from the browser,
// without the page itself reading cookies. Says nothing else about the user.

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const admin = (await getAdmin()) !== null;
  return Response.json({ admin }, { headers: { "Cache-Control": "private, no-store" } });
}
