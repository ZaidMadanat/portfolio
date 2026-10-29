import { invalidLinkPage, linkPage, readToken, toSubscribed } from "@/lib/email/link-page";
import { isUnsubscribeTokenValid, unsubscribe } from "@/lib/email/subscribers";

// /api/unsubscribe?token=<unsubscribeToken> (spec §9.4).
// GET: the link in every email. Renders a page with an Unsubscribe button and
//   changes nothing, so link-scanning mail filters can't unsubscribe anyone.
// POST from that button: unsubscribes, then 303 to /subscribed.
// POST with body `List-Unsubscribe=One-Click`: RFC 8058 one-click from the
//   List-Unsubscribe header (mail clients POST to this URL); 200 plain text.
export const dynamic = "force-dynamic";

const ONE_CLICK = "One-Click";

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function GET(req: Request): Promise<Response> {
  const token = await readToken(req);
  if (!(await isUnsubscribeTokenValid(token))) return invalidLinkPage();
  return linkPage({
    title: "Unsubscribe from new-post emails?",
    body: "You'll stop getting an email when a new post goes out. The RSS feed stays open.",
    button: { label: "Unsubscribe", action: `/api/unsubscribe?token=${encodeURIComponent(token)}` },
  });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const oneClick = form?.get("List-Unsubscribe") === ONE_CLICK;
  const ok = (await unsubscribe(await readToken(req, form))) === "unsubscribed";
  if (oneClick) return ok ? text("Unsubscribed.", 200) : text("Invalid or expired link.", 400);
  return ok ? toSubscribed(req, "unsubscribed") : invalidLinkPage();
}
