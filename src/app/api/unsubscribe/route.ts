import { unsubscribe } from "@/lib/email/subscribers";

// /api/unsubscribe?token=<unsubscribeToken> (spec §9.4).
// GET: the link in every email; redirects to the static /subscribed page.
// POST: RFC 8058 one-click unsubscribe from the List-Unsubscribe header (mail
// clients POST `List-Unsubscribe=One-Click` to the same URL); plain response.
export const dynamic = "force-dynamic";

const tokenFrom = (req: Request) => new URL(req.url).searchParams.get("token") ?? "";

export async function GET(req: Request): Promise<Response> {
  const state = (await unsubscribe(tokenFrom(req))) === "unsubscribed" ? "unsubscribed" : "invalid-link";
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(`/subscribed?state=${state}`, req.url).toString(), "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const ok = (await unsubscribe(tokenFrom(req))) === "unsubscribed";
  return new Response(ok ? "Unsubscribed." : "Invalid or expired link.", {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
