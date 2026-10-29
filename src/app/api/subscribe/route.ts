import { likeSecret, rateLimited } from "@/lib/counter-api";
import { visitorHash } from "@/lib/counters";
import { EmailQuotaError } from "@/lib/email/send";
import { emailSchema, subscribe } from "@/lib/email/subscribers";
import { allowRequest, RATE_LIMITS } from "@/lib/redis";

// POST /api/subscribe (spec §9.4). The blog's SubscribeBanner posts JSON
// {email} with fetch and gets JSON back; without JS the same <form> posts
// form-encoded `email` and gets a 303 to the static /subscribed page.
export const dynamic = "force-dynamic";

type State = "pending" | "already" | "invalid-email" | "busy" | "error";

const STATUS: Record<State, number> = { pending: 200, already: 200, "invalid-email": 400, busy: 429, error: 500 };

async function readEmail(req: Request): Promise<{ form: boolean; email: unknown }> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body: unknown = await req.json().catch(() => null);
    return { form: false, email: body && typeof body === "object" ? (body as { email?: unknown }).email : undefined };
  }
  const data = await req.formData().catch(() => null);
  return { form: true, email: data?.get("email") ?? undefined };
}

async function handle(req: Request, email: unknown): Promise<State> {
  if (await rateLimited(req, RATE_LIMITS.subscribeIp)) return "busy";
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return "invalid-email";
  const key = await visitorHash(`email:${parsed.data}`, likeSecret());
  if (!(await allowRequest(key, RATE_LIMITS.subscribeEmail))) return "busy";
  try {
    return await subscribe(parsed.data);
  } catch (err) {
    if (err instanceof EmailQuotaError) return "busy";
    console.error("[subscribe] failed:", err instanceof Error ? err.message : "unknown error");
    return "error";
  }
}

export async function POST(req: Request): Promise<Response> {
  const { form, email } = await readEmail(req);
  const state = await handle(req, email);
  if (form) {
    const to = new URL(`/subscribed?state=${state}`, req.url);
    return new Response(null, { status: 303, headers: { Location: to.toString(), "Cache-Control": "no-store" } });
  }
  const body = state === "pending" || state === "already" ? { status: state } : { error: state };
  return Response.json(body, { status: STATUS[state], headers: { "Cache-Control": "no-store" } });
}
