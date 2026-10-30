import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeMailer, getMailer, logMailer, resendMailer, type Msg } from "@/lib/email/send";

const msg = (i: number): Msg => ({
  to: `r${i}@example.com`,
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
  headers: { "List-Unsubscribe": "<https://x/u>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
});

afterEach(() => vi.unstubAllEnvs());

function stubFetch(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return responses.shift() ?? new Response("{}", { status: 200 });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

describe("resendMailer", () => {
  it("posts batches of at most 100 with from, to, subject, html, text and headers", async () => {
    const { fetch, calls } = stubFetch([]);
    const mailer = resendMailer({ apiKey: "re_test", from: "Zaid <z@example.com>", fetch });
    const msgs = Array.from({ length: 150 }, (_, i) => msg(i));
    expect(await mailer.sendBatch(msgs)).toEqual({ sent: 150, quotaHit: false });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://api.resend.com/emails/batch");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const first = JSON.parse(String(calls[0].init.body));
    expect(first).toHaveLength(100);
    expect(first[0]).toEqual({
      from: "Zaid <z@example.com>",
      to: ["r0@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      headers: msgs[0].headers,
    });
    expect(JSON.parse(String(calls[1].init.body))).toHaveLength(50);
  });

  it("stops with quotaHit on a daily quota error, keeping what already went out", async () => {
    const { fetch } = stubFetch([
      new Response("{}", { status: 200 }),
      Response.json({ statusCode: 429, name: "daily_quota_exceeded", message: "quota" }, { status: 429 }),
    ]);
    const mailer = resendMailer({ apiKey: "k", from: "f@example.com", fetch });
    const msgs = Array.from({ length: 150 }, (_, i) => msg(i));
    expect(await mailer.sendBatch(msgs)).toEqual({ sent: 100, quotaHit: true });
  });

  it("throws on other errors with the status and error name only (never the key)", async () => {
    const { fetch } = stubFetch([Response.json({ name: "validation_error", message: "bad" }, { status: 422 })]);
    const mailer = resendMailer({ apiKey: "re_secret_key", from: "f@example.com", fetch });
    const err = await mailer.sendBatch([msg(0)]).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Resend batch send failed: HTTP 422 validation_error");
    expect((err as Error).message).not.toContain("re_secret_key");
  });
});

describe("fakeMailer", () => {
  it("accepts up to its daily limit, then reports quotaHit", async () => {
    const mailer = fakeMailer({ dailyLimit: 3 });
    expect(await mailer.sendBatch([msg(0), msg(1)])).toEqual({ sent: 2, quotaHit: false });
    expect(await mailer.sendBatch([msg(2), msg(3)])).toEqual({ sent: 1, quotaHit: true });
    expect(mailer.sent.map((m) => m.to)).toEqual(["r0@example.com", "r1@example.com", "r2@example.com"]);
  });
});

describe("getMailer", () => {
  it("uses the dev log mailer locally without RESEND_API_KEY, which sends nothing and logs no addresses", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getMailer().sendBatch([msg(0)])).toEqual({ sent: 1, quotaHit: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).not.toContain("r0@example.com");
    info.mockRestore();
    fetchSpy.mockRestore();
    expect(await logMailer().sendBatch([])).toEqual({ sent: 0, quotaHit: false });
  });

  it("requires RESEND_API_KEY on Vercel", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL", "1");
    expect(() => getMailer()).toThrow("RESEND_API_KEY is not set");
  });
});
