import type { SyncSource } from "@/generated/prisma/client";
import { cronAuthorized } from "@/lib/sync/cron-auth";
import { runSync } from "@/lib/sync/run";

// The shared GET handler of /api/cron/{letterboxd,statsfm,strava,housekeeping}.
// A failed sync is still a 200: the run is logged ok=false and the body says so,
// so Vercel doesn't retry a source that's down.

const NO_STORE = { "Cache-Control": "no-store" };

export function cronHandler(source: SyncSource) {
  return async function GET(req: Request): Promise<Response> {
    if (!cronAuthorized(req.headers.get("authorization"))) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
    }
    const run = await runSync(source);
    return Response.json({ ok: run.ok, itemsChanged: run.itemsChanged }, { headers: NO_STORE });
  };
}
