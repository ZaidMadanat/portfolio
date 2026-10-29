import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { drainEmailQueue, enqueuePostNotification } from "@/lib/email/queue";
import { fakeMailer, type Msg } from "@/lib/email/send";
import { confirmSubscription, subscribe, unsubscribe } from "@/lib/email/subscribers";
import { resetDb } from "./reset";

// No Upstash in tests: the subscribe rate limit always allows.
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");

beforeEach(resetDb);

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function publishedPost(extra: Record<string, unknown> = {}) {
  return db.post.create({
    data: {
      slug: "a-post",
      title: "Tea & Toast <3",
      excerpt: "An excerpt",
      blocks: [],
      category: "NOTES",
      status: "PUBLISHED",
      publishedAt: new Date("2026-10-01T12:00:00Z"),
      ...extra,
    },
  });
}

async function confirmedSubscribers(n: number) {
  await db.subscriber.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      email: `reader${i}@example.com`,
      status: "CONFIRMED" as const,
      confirmToken: `confirm-${i}`,
      unsubscribeToken: `unsub-${i}`,
      confirmedAt: new Date(),
    })),
  });
}

const notifiedAt = async (id: string) => (await db.post.findUniqueOrThrow({ where: { id } })).notifiedAt;

function expectUnsubscribeHeaders(msg: Msg, token: string) {
  expect(msg.headers["List-Unsubscribe"]).toBe(`<https://example.test/api/unsubscribe?token=${token}>`);
  expect(msg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
}

describe("new-post email queue", () => {
  it("stops at the daily quota and resumes on the next run; notifiedAt is set only when the queue is empty", async () => {
    const post = await publishedPost();
    await confirmedSubscribers(150);
    expect(await enqueuePostNotification(post.id)).toBe(150);

    const day1 = fakeMailer({ dailyLimit: 100 });
    expect(await drainEmailQueue(day1, { chunk: 100 })).toEqual({ sent: 100, remaining: 50 });
    expect(await notifiedAt(post.id)).toBeNull();
    expect(await db.emailSend.count({ where: { status: "QUEUED" } })).toBe(50);

    const day2 = fakeMailer({ dailyLimit: 100 });
    expect(await drainEmailQueue(day2, { chunk: 100 })).toEqual({ sent: 50, remaining: 0 });
    expect(await notifiedAt(post.id)).toBeInstanceOf(Date);
    expect(await db.emailSend.count({ where: { status: "SENT", sentAt: { not: null } } })).toBe(150);

    // Nobody got the email twice.
    const recipients = [...day1.sent, ...day2.sent].map((m) => m.to);
    expect(new Set(recipients).size).toBe(150);
  });

  it("resumes mid-chunk when the quota runs out part-way through one", async () => {
    const post = await publishedPost();
    await confirmedSubscribers(30);
    await enqueuePostNotification(post.id);
    expect(await drainEmailQueue(fakeMailer({ dailyLimit: 25 }), { chunk: 10 })).toEqual({ sent: 25, remaining: 5 });
    expect(await drainEmailQueue(fakeMailer({ dailyLimit: 25 }), { chunk: 10 })).toEqual({ sent: 5, remaining: 0 });
  });

  it("builds the new-post email: title, excerpt, Read it link, unsubscribe link and headers", async () => {
    const post = await publishedPost();
    await confirmedSubscribers(1);
    await enqueuePostNotification(post.id);
    const mailer = fakeMailer({ dailyLimit: 100 });
    await drainEmailQueue(mailer, { chunk: 100 });
    const [msg] = mailer.sent;
    expect(msg.to).toBe("reader0@example.com");
    expect(msg.subject).toBe("Tea & Toast <3");
    expect(msg.html).toContain("Tea &amp; Toast &lt;3");
    expect(msg.html).toContain("An excerpt");
    expect(msg.html).toContain('href="https://example.test/blog/a-post"');
    expect(msg.html).toContain("Read it");
    expect(msg.html).toContain('href="https://example.test/api/unsubscribe?token=unsub-0"');
    expect(msg.text).toContain("https://example.test/blog/a-post");
    expectUnsubscribeHeaders(msg, "unsub-0");
  });

  it("creates 0 rows for an already-notified post", async () => {
    const post = await publishedPost({ notifiedAt: new Date() });
    await confirmedSubscribers(3);
    expect(await enqueuePostNotification(post.id)).toBe(0);
    expect(await db.emailSend.count()).toBe(0);
  });

  it("queues only confirmed subscribers, once each, and never for a draft", async () => {
    const post = await publishedPost();
    await confirmedSubscribers(2);
    await db.subscriber.create({ data: { email: "p@example.com", confirmToken: "c-p", unsubscribeToken: "u-p" } });
    expect(await enqueuePostNotification(post.id)).toBe(2);
    expect(await enqueuePostNotification(post.id)).toBe(0);

    const draft = await db.post.create({ data: { slug: "draft", title: "Draft", blocks: [], category: "NOTES" } });
    expect(await enqueuePostNotification(draft.id)).toBe(0);
  });

  it("marks a post notified straight away when nobody is subscribed, so a later publish never sends", async () => {
    const post = await publishedPost();
    expect(await enqueuePostNotification(post.id)).toBe(0);
    expect(await notifiedAt(post.id)).toBeInstanceOf(Date);
  });

  it("drops queued sends for someone who unsubscribes before the drain", async () => {
    const post = await publishedPost();
    await confirmedSubscribers(2);
    await enqueuePostNotification(post.id);
    expect(await unsubscribe("unsub-1")).toBe("unsubscribed");
    const mailer = fakeMailer({ dailyLimit: 100 });
    expect(await drainEmailQueue(mailer, { chunk: 100 })).toEqual({ sent: 1, remaining: 0 });
    expect(mailer.sent.map((m) => m.to)).toEqual(["reader0@example.com"]);
  });
});

describe("subscribe, confirm, unsubscribe", () => {
  it("stores a PENDING subscriber with separate random tokens and sends the confirmation", async () => {
    const mailer = fakeMailer({ dailyLimit: 100 });
    expect(await subscribe("  Reader@Example.com ", { mailer })).toBe("pending");
    const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    expect(sub.status).toBe("PENDING");
    expect(sub.confirmToken).toMatch(TOKEN);
    expect(sub.unsubscribeToken).toMatch(TOKEN);
    expect(sub.confirmToken).not.toBe(sub.unsubscribeToken);

    expect(mailer.sent).toHaveLength(1);
    const [msg] = mailer.sent;
    expect(msg.to).toBe("reader@example.com");
    expect(msg.html).toContain(`https://example.test/api/subscribe/confirm?token=${sub.confirmToken}`);
    expectUnsubscribeHeaders(msg, sub.unsubscribeToken);
  });

  it("re-sends the confirmation while pending, and says 'already' once confirmed", async () => {
    const mailer = fakeMailer({ dailyLimit: 100 });
    await subscribe("reader@example.com", { mailer });
    expect(await subscribe("reader@example.com", { mailer })).toBe("pending");
    expect(mailer.sent).toHaveLength(2);

    const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    expect(await confirmSubscription(sub.confirmToken)).toBe("confirmed");
    const confirmed = await db.subscriber.findUniqueOrThrow({ where: { id: sub.id } });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);

    expect(await subscribe("reader@example.com", { mailer })).toBe("already");
    expect(mailer.sent).toHaveLength(2);
  });

  it("refuses to unsubscribe with the confirm token, and works with the unsubscribe token", async () => {
    await subscribe("reader@example.com", { mailer: fakeMailer({ dailyLimit: 100 }) });
    const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    await confirmSubscription(sub.confirmToken);

    expect(await unsubscribe(sub.confirmToken)).toBe("invalid");
    expect((await db.subscriber.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("CONFIRMED");

    expect(await unsubscribe(sub.unsubscribeToken)).toBe("unsubscribed");
    expect((await db.subscriber.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("UNSUBSCRIBED");
  });

  it("can't confirm with the unsubscribe token, and an old confirm link can't undo an unsubscribe", async () => {
    await subscribe("reader@example.com", { mailer: fakeMailer({ dailyLimit: 100 }) });
    const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    expect(await confirmSubscription(sub.unsubscribeToken)).toBe("invalid");
    await confirmSubscription(sub.confirmToken);
    await unsubscribe(sub.unsubscribeToken);
    expect(await confirmSubscription(sub.confirmToken)).toBe("invalid");
  });

  it("an unsubscribed reader can sign up again, with fresh tokens", async () => {
    const mailer = fakeMailer({ dailyLimit: 100 });
    await subscribe("reader@example.com", { mailer });
    const before = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    await unsubscribe(before.unsubscribeToken);
    expect(await subscribe("reader@example.com", { mailer })).toBe("pending");
    const after = await db.subscriber.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("PENDING");
    expect(after.confirmToken).not.toBe(before.confirmToken);
    expect(after.unsubscribeToken).not.toBe(before.unsubscribeToken);
  });

  it("leaves the subscriber pending and throws when the confirmation hits the quota", async () => {
    await expect(subscribe("reader@example.com", { mailer: fakeMailer({ dailyLimit: 0 }) })).rejects.toThrow(/quota/i);
    expect((await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } })).status).toBe("PENDING");
  });
});

describe("routes", () => {
  const subscribeRoute = () => import("@/app/api/subscribe/route");
  const confirmRoute = () => import("@/app/api/subscribe/confirm/route");
  const unsubscribeRoute = () => import("@/app/api/unsubscribe/route");

  const json = (body: unknown) =>
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const form = (email: string) =>
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email }).toString(),
    });

  it("POST /api/subscribe returns 400 for an invalid email (JSON)", async () => {
    const { POST } = await subscribeRoute();
    for (const body of [{ email: "not-an-email" }, { email: "" }, {}, { email: 42 }]) {
      const res = await POST(json(body));
      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    const res = await POST(
      new Request("http://localhost/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }),
    );
    expect(res.status).toBe(400);
    expect(await db.subscriber.count()).toBe(0);
  });

  it("POST /api/subscribe with JSON returns {status:'pending'}, then 'already' once confirmed", async () => {
    const { POST } = await subscribeRoute();
    const res = await POST(json({ email: "reader@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "pending" });
    await db.subscriber.update({ where: { email: "reader@example.com" }, data: { status: "CONFIRMED" } });
    expect(await (await POST(json({ email: "reader@example.com" }))).json()).toEqual({ status: "already" });
  });

  it("POST /api/subscribe with a form redirects to /subscribed with the state (no JS)", async () => {
    const { POST } = await subscribeRoute();
    const ok = await POST(form("reader@example.com"));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("http://localhost/subscribed?state=pending");
    const bad = await POST(form("nope"));
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toBe("http://localhost/subscribed?state=invalid-email");
  });

  it("GET /api/subscribe/confirm confirms with the confirm token and redirects", async () => {
    await subscribe("reader@example.com", { mailer: fakeMailer({ dailyLimit: 100 }) });
    const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "reader@example.com" } });
    const { GET } = await confirmRoute();
    const bad = await GET(new Request(`http://localhost/api/subscribe/confirm?token=${sub.unsubscribeToken}`));
    expect(bad.headers.get("location")).toBe("http://localhost/subscribed?state=invalid-link");
    const ok = await GET(new Request(`http://localhost/api/subscribe/confirm?token=${sub.confirmToken}`));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("http://localhost/subscribed?state=confirmed");
  });

  it("/api/unsubscribe: the confirm token fails, the unsubscribe token works (GET link and one-click POST)", async () => {
    await confirmedSubscribers(2);
    const { GET, POST } = await unsubscribeRoute();

    const wrong = await GET(new Request("http://localhost/api/unsubscribe?token=confirm-0"));
    expect(wrong.headers.get("location")).toBe("http://localhost/subscribed?state=invalid-link");
    expect((await db.subscriber.findUniqueOrThrow({ where: { email: "reader0@example.com" } })).status).toBe("CONFIRMED");

    const link = await GET(new Request("http://localhost/api/unsubscribe?token=unsub-0"));
    expect(link.status).toBe(303);
    expect(link.headers.get("location")).toBe("http://localhost/subscribed?state=unsubscribed");
    expect((await db.subscriber.findUniqueOrThrow({ where: { email: "reader0@example.com" } })).status).toBe("UNSUBSCRIBED");

    const oneClick = await POST(
      new Request("http://localhost/api/unsubscribe?token=unsub-1", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    expect(oneClick.status).toBe(200);
    expect((await db.subscriber.findUniqueOrThrow({ where: { email: "reader1@example.com" } })).status).toBe("UNSUBSCRIBED");

    const missing = await POST(new Request("http://localhost/api/unsubscribe", { method: "POST" }));
    expect(missing.status).toBe(400);
  });
});
