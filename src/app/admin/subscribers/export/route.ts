import { subscribersCsv } from "@/lib/admin/csv";
import { listSubscribers } from "@/lib/admin/subscribers";
import { AdminAuthError, requireAdmin, unauthorized } from "@/lib/require-admin";

// GET /admin/subscribers/export: every subscriber as CSV
// (`email,status,createdAt`), downloaded as subscribers-<date>.csv.

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireAdmin({ onFail: "throw" });
  } catch (err) {
    if (err instanceof AdminAuthError) return unauthorized();
    throw err;
  }
  const csv = subscribersCsv(await listSubscribers());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
