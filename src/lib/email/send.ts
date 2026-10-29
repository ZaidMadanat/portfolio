import { requireEnv } from "@/lib/env";

// Mail transport (spec §9.4). The queue and the subscribe flow only see
// `Mailer`, so tests swap in fakeMailer and local dev uses logMailer.

export type Msg = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Always carries List-Unsubscribe and List-Unsubscribe-Post (templates.ts). */
  headers: Record<string, string>;
};

/**
 * Sends messages in order. `sent` is how many from the front of `msgs` went
 * out; `quotaHit` means the provider refused the rest for quota or rate limit,
 * so the caller should stop and try again on a later run. Other failures throw.
 */
export type Mailer = {
  sendBatch(msgs: Msg[]): Promise<{ sent: number; quotaHit: boolean }>;
};

/** Thrown when a single message (a confirmation) can't go out because of the quota. */
export class EmailQuotaError extends Error {
  constructor() {
    super("Email quota reached; try again later");
    this.name = "EmailQuotaError";
  }
}

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
/** Resend's batch endpoint takes at most 100 emails per call. */
export const RESEND_BATCH_MAX = 100;
// Free tier: 100/day, 3,000/month (spec §9.4). Rate limits also mean "stop for now".
const QUOTA_ERRORS = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
  "email_above_quota",
]);

type ResendOptions = { apiKey?: string; from?: string; fetch?: typeof fetch };

/**
 * Resend batch API over fetch (no SDK). A batch is all-or-nothing, so `sent`
 * is either the whole chunk or what went out before the quota was hit.
 * Error messages carry the HTTP status and Resend's error name only.
 */
export function resendMailer(opts: ResendOptions = {}): Mailer {
  return {
    async sendBatch(msgs) {
      const apiKey = opts.apiKey ?? requireEnv("RESEND_API_KEY");
      const from = opts.from ?? requireEnv("RESEND_FROM");
      const doFetch = opts.fetch ?? fetch;
      let sent = 0;
      for (let i = 0; i < msgs.length; i += RESEND_BATCH_MAX) {
        const chunk = msgs.slice(i, i + RESEND_BATCH_MAX);
        const res = await doFetch(RESEND_BATCH_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(
            chunk.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, headers: m.headers })),
          ),
        });
        if (res.ok) {
          sent += chunk.length;
          continue;
        }
        const name = await res
          .json()
          .then((b: { name?: unknown }) => (typeof b?.name === "string" ? b.name : "unknown"))
          .catch(() => "unknown");
        if (res.status === 429 || QUOTA_ERRORS.has(name)) return { sent, quotaHit: true };
        throw new Error(`Resend batch send failed: HTTP ${res.status} ${name}`);
      }
      return { sent, quotaHit: false };
    },
  };
}

export type FakeMailer = Mailer & { sent: Msg[] };

/** Test mailer: accepts up to `dailyLimit` messages over its lifetime (one "day"), then reports quotaHit. */
export function fakeMailer({ dailyLimit }: { dailyLimit: number }): FakeMailer {
  const sent: Msg[] = [];
  return {
    sent,
    async sendBatch(msgs) {
      const room = Math.max(0, dailyLimit - sent.length);
      const accepted = msgs.slice(0, room);
      sent.push(...accepted);
      return { sent: accepted.length, quotaHit: accepted.length < msgs.length };
    },
  };
}

/**
 * Local dev without RESEND_API_KEY: sends nothing and logs only a count and
 * the subject (never addresses, links or tokens). Silent under test.
 */
export function logMailer(): Mailer {
  return {
    async sendBatch(msgs) {
      if (process.env.NODE_ENV !== "test" && msgs.length > 0) {
        console.info(`[email] RESEND_API_KEY not set; not sending ${msgs.length} message(s): "${msgs[0].subject}"`);
      }
      return { sent: msgs.length, quotaHit: false };
    },
  };
}

/** Resend when RESEND_API_KEY is set; on Vercel it's required; else the dev log mailer. */
export function getMailer(): Mailer {
  if (process.env.RESEND_API_KEY?.trim()) return resendMailer();
  if (process.env.VERCEL) throw new Error("RESEND_API_KEY is not set");
  return logMailer();
}
