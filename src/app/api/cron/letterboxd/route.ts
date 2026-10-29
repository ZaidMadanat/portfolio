import { cronHandler } from "@/lib/sync/cron-route";

// Vercel cron (vercel.json, spec §9.1). Bearer CRON_SECRET only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = cronHandler("LETTERBOXD");
