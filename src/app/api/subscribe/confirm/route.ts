import { invalidLinkPage, linkPage, readToken, toSubscribed } from "@/lib/email/link-page";
import { confirmSubscription, isConfirmTokenValid } from "@/lib/email/subscribers";

// /api/subscribe/confirm?token=<confirmToken> (spec §9.4), linked from the
// confirmation email. GET never changes anything: it renders a page whose
// button POSTs back here, so link-scanning mail filters can't confirm anyone.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const token = await readToken(req);
  if (!(await isConfirmTokenValid(token))) return invalidLinkPage();
  return linkPage({
    title: "Confirm your subscription",
    body: "One click and you'll get new posts by email. Every email has a link to unsubscribe.",
    button: {
      label: "Confirm subscription",
      action: `/api/subscribe/confirm?token=${encodeURIComponent(token)}`,
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const result = await confirmSubscription(await readToken(req, form));
  return result === "confirmed" ? toSubscribed(req, "confirmed") : invalidLinkPage();
}
