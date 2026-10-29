import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// The posts list, templates and subscribers admin (spec §7) against the test
// database, with the admin check stubbed.

const admin = vi.hoisted(() => ({ signedIn: true }));

vi.mock("@/lib/require-admin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/require-admin")>();
  return {
    ...real,
    requireAdmin: async () => {
      if (!admin.signedIn) throw new real.AdminAuthError();
      return { userId: "u1" };
    },
  };
});

const { listAdminPosts, parsePostFilter } = await import("@/lib/admin/posts");
const { listTemplates } = await import("@/lib/admin/templates");
const { removeSubscriber } = await import("@/app/admin/subscribers/actions");
const { deleteTemplate } = await import("@/app/admin/templates/actions");
const { GET: exportCsv } = await import("@/app/admin/subscribers/export/route");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
});

const post = (slug: string, status: "DRAFT" | "PUBLISHED") =>
  db.post.create({
    data: { slug, title: slug, blocks: [], category: "NOTES", status, publishedAt: status === "PUBLISHED" ? new Date() : null },
  });

let n = 0;
const subscriber = (email: string, status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED", createdAt = new Date()) =>
  db.subscriber.create({ data: { email, status, createdAt, confirmToken: `c${++n}`, unsubscribeToken: `u${n}` } });

describe("listAdminPosts", () => {
  it("filters by status and counts both", async () => {
    await post("a-draft", "DRAFT");
    await post("b-live", "PUBLISHED");
    await post("c-live", "PUBLISHED");

    const all = await listAdminPosts("all");
    expect(all.rows.map((r) => r.slug).sort()).toEqual(["a-draft", "b-live", "c-live"]);
    expect(all.counts).toEqual({ all: 3, draft: 1, published: 2 });
    expect((await listAdminPosts("draft")).rows.map((r) => r.slug)).toEqual(["a-draft"]);
    expect((await listAdminPosts("published")).rows.map((r) => r.slug).sort()).toEqual(["b-live", "c-live"]);
  });

  it("reads the filter from ?status=, defaulting to all", () => {
    expect(parsePostFilter("draft")).toBe("draft");
    expect(parsePostFilter(["published", "draft"])).toBe("published");
    expect(parsePostFilter("nope")).toBe("all");
    expect(parsePostFilter(undefined)).toBe("all");
  });
});

describe("templates", () => {
  it("lists built-ins first with their outline", async () => {
    await db.template.create({ data: { name: "Mine", blocks: [{ type: "heading", content: "Only" }] } });
    await db.template.create({
      data: { name: "Notes / cheat sheet", builtIn: true, category: "NOTES", blocks: [{ type: "heading", content: "Summary" }] },
    });
    const list = await listTemplates();
    expect(list.map((t) => [t.name, t.builtIn, t.outline])).toEqual([
      ["Notes / cheat sheet", true, ["Summary"]],
      ["Mine", false, ["Only"]],
    ]);
  });

  it("deletes a saved template; posts started from it keep their content", async () => {
    const t = await db.template.create({ data: { name: "Mine", blocks: [] } });
    const p = await db.post.create({ data: { slug: "p", title: "p", blocks: [], category: "NOTES", templateId: t.id } });
    await deleteTemplate(t.id);
    expect(await db.template.findUnique({ where: { id: t.id } })).toBeNull();
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).templateId).toBeNull();
  });

  it("refuses to delete a built-in", async () => {
    const t = await db.template.create({ data: { name: "Essay", builtIn: true, blocks: [] } });
    await expect(deleteTemplate(t.id)).rejects.toThrow("built-in");
    expect(await db.template.findUnique({ where: { id: t.id } })).not.toBeNull();
  });

  it("needs an admin session", async () => {
    const t = await db.template.create({ data: { name: "Mine", blocks: [] } });
    admin.signedIn = false;
    await expect(deleteTemplate(t.id)).rejects.toThrow();
    expect(await db.template.findUnique({ where: { id: t.id } })).not.toBeNull();
  });
});

describe("subscribers", () => {
  it("removes a subscriber and their queued sends", async () => {
    const s = await subscriber("a@example.com", "CONFIRMED");
    const p = await post("live", "PUBLISHED");
    await db.emailSend.create({ data: { postId: p.id, subscriberId: s.id } });
    await removeSubscriber(s.id);
    expect(await db.subscriber.count()).toBe(0);
    expect(await db.emailSend.count()).toBe(0);
  });

  it("removing someone already gone is a no-op", async () => {
    await expect(removeSubscriber("missing")).resolves.toBeUndefined();
  });

  it("needs an admin session to remove", async () => {
    const s = await subscriber("a@example.com", "PENDING");
    admin.signedIn = false;
    await expect(removeSubscriber(s.id)).rejects.toThrow();
    expect(await db.subscriber.count()).toBe(1);
  });

  it("exports email,status,createdAt as a CSV download", async () => {
    await subscriber("old@example.com", "UNSUBSCRIBED", new Date("2026-09-01T10:00:00Z"));
    await subscriber("new@example.com", "CONFIRMED", new Date("2026-10-01T10:00:00Z"));
    const res = await exportCsv();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="subscribers-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(
      "email,status,createdAt\r\nnew@example.com,CONFIRMED,2026-10-01T10:00:00.000Z\r\nold@example.com,UNSUBSCRIBED,2026-09-01T10:00:00.000Z\r\n",
    );
  });

  it("the export is a 401 without an admin session", async () => {
    await subscriber("a@example.com", "CONFIRMED");
    admin.signedIn = false;
    const res = await exportCsv();
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("a@example.com");
  });
});
