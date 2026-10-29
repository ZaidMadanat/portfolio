import { confirmSubscription } from "@/lib/email/subscribers";

// GET /api/subscribe/confirm?token=<confirmToken> (spec §9.4), linked from the
// confirmation email. Redirects to the static /subscribed page.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const result = await confirmSubscription(token);
  const state = result === "confirmed" ? "confirmed" : "invalid-link";
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(`/subscribed?state=${state}`, req.url).toString(), "Cache-Control": "no-store" },
  });
}
