import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// POST /api/admin/media end to end against the test database, with the admin
// check stubbed and the local store pointed at a temp folder.

const root = mkdtempSync(join(tmpdir(), "media-route-"));
const admin = vi.hoisted(() => ({ signedIn: true }));
const storeFails = vi.hoisted(() => ({ on: false }));

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
vi.mock("@/lib/media/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/media/store")>();
  return {
    ...real,
    getMediaStore: () => {
      const store = real.localStore(root);
      return {
        ...store,
        put: async (path: string, body: Buffer) => {
          if (storeFails.on && path.endsWith("/1600.webp")) throw new Error("blob down");
          return store.put(path, body);
        },
      };
    },
  };
});

const { POST } = await import("@/app/api/admin/media/route");

beforeEach(async () => {
  await resetDb();
  admin.signedIn = true;
  storeFails.on = false;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const GPS = { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 46/1 0/1" } };
const jpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#2e4bff" } })
    .jpeg()
    .withMetadata({ exif: GPS })
    .toBuffer();

function upload(body: Blob | string | null, name = "IMG_0042.jpg") {
  const form = new FormData();
  if (typeof body === "string") form.append("file", body);
  else if (body !== null) form.append("file", body, name);
  return POST(new Request("http://localhost/api/admin/media", { method: "POST", body: form }));
}

describe("POST /api/admin/media", () => {
  it("is 401 without an admin session, and stores nothing", async () => {
    admin.signedIn = false;
    const res = await upload(new Blob([await jpeg(100, 100)], { type: "image/jpeg" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(await db.media.count()).toBe(0);
  });

  it("stores every size without metadata and records the Media row", async () => {
    const res = await upload(new Blob([await jpeg(3000, 2000)], { type: "image/jpeg" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ id: expect.any(String), url960: `/uploads/media/${body.id}/960.webp`, width: 2400, height: 1600 });

    const row = await db.media.findUniqueOrThrow({ where: { id: body.id } });
    expect(row).toMatchObject({ blobUrl: `/uploads/media/${body.id}/2400.webp`, filename: "IMG_0042.jpg", width: 2400, height: 1600, alt: "" });
    expect(row.blurDataUrl).toMatch(/^data:image\/webp;base64,/);

    const dir = join(root, "media", body.id);
    expect(readdirSync(dir).sort()).toEqual(["1600.webp", "2400.webp", "480.webp", "960.webp"]);
    expect(row.bytes).toBe(readFileSync(join(dir, "2400.webp")).length);
    for (const f of readdirSync(dir)) {
      const meta = await sharp(readFileSync(join(dir, f))).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
  });

  it("returns the largest size as url960 for a small photo", async () => {
    const res = await upload(new Blob([await jpeg(600, 400)], { type: "image/jpeg" }));
    const body = await res.json();
    expect(body.url960).toBe(`/uploads/media/${body.id}/600.webp`);
  });

  it("gives the friendly error for bytes it can't read (e.g. HEIC)", async () => {
    const res = await upload(new Blob([Buffer.from("ftypheic not really")], { type: "image/heic" }), "IMG_1.HEIC");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "unsupported",
      message: "Couldn't process this photo. Export it as JPEG and try again.",
    });
    expect(await db.media.count()).toBe(0);
  });

  it("is 400 without a file and 413 over 4 MB", async () => {
    expect((await upload(null)).status).toBe(400);
    expect((await upload("just text")).status).toBe(400);
    const big = await upload(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: "image/webp" }));
    expect(big.status).toBe(413);
    expect((await big.json()).error).toBe("too-large");
  });

  it("cleans up written sizes and records nothing when storage fails", async () => {
    const dirs = () => readdirSync(join(root, "media")).sort();
    await upload(new Blob([await jpeg(100, 100)], { type: "image/jpeg" }));
    const before = dirs();
    storeFails.on = true;
    const res = await upload(new Blob([await jpeg(3000, 2000)], { type: "image/jpeg" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "error", message: "Upload failed. Try again." });
    expect(await db.media.count()).toBe(1);
    expect(dirs()).toEqual(before);
  });

  it("trims odd filenames", async () => {
    const res = await upload(new Blob([await jpeg(100, 100)], { type: "image/jpeg" }), `../../${"a".repeat(300)}\u0000.jpg`);
    const { id } = await res.json();
    const row = await db.media.findUniqueOrThrow({ where: { id } });
    expect(row.filename.length).toBeLessThanOrEqual(200);
    expect(row.filename).not.toMatch(/[/\\\u0000]/);
  });
});
