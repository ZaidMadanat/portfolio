import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
const del = vi.fn();
const list = vi.fn();
vi.mock("@vercel/blob", () => ({ put, del, list }));

const { blobStore, getMediaStore, localStore } = await import("@/lib/media/store");

afterEach(() => {
  vi.unstubAllEnvs();
  put.mockReset();
  del.mockReset();
  list.mockReset();
});

describe("localStore (dev, no BLOB_READ_WRITE_TOKEN)", () => {
  it("writes under <root>/media/<id>/<width>.webp and serves it from /uploads", async () => {
    const root = mkdtempSync(join(tmpdir(), "media-"));
    try {
      const store = localStore(root);
      const url = await store.put("media/cm1/480.webp", Buffer.from("webp"));
      expect(url).toBe("/uploads/media/cm1/480.webp");
      expect(readFileSync(join(root, "media/cm1/480.webp"), "utf8")).toBe("webp");
      await store.remove("cm1");
      expect(() => readFileSync(join(root, "media/cm1/480.webp"))).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses paths outside the media scheme", async () => {
    const store = localStore(tmpdir());
    await expect(store.put("../../evil.webp", Buffer.from(""))).rejects.toThrow();
    await expect(store.put("media/a/b/../../x.webp", Buffer.from(""))).rejects.toThrow();
    await expect(store.remove("../x")).rejects.toThrow();
  });
});

describe("blobStore", () => {
  it("puts a public, immutable WebP at the exact path", async () => {
    put.mockResolvedValue({ url: "https://s.public.blob.vercel-storage.com/media/cm1/480.webp" });
    const url = await blobStore("tok").put("media/cm1/480.webp", Buffer.from("x"));
    expect(url).toBe("https://s.public.blob.vercel-storage.com/media/cm1/480.webp");
    expect(put).toHaveBeenCalledWith("media/cm1/480.webp", Buffer.from("x"), {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 31536000,
      token: "tok",
    });
  });
});

describe("blobStore.remove", () => {
  it("deletes every size under media/<id>/", async () => {
    list.mockResolvedValue({ blobs: [{ url: "https://s/media/cm1/480.webp" }, { url: "https://s/media/cm1/600.webp" }] });
    await blobStore("tok").remove("cm1");
    expect(list).toHaveBeenCalledWith({ prefix: "media/cm1/", token: "tok" });
    expect(del).toHaveBeenCalledWith(["https://s/media/cm1/480.webp", "https://s/media/cm1/600.webp"], { token: "tok" });
  });
});

describe("getMediaStore", () => {
  it("uses Blob when BLOB_READ_WRITE_TOKEN is set, else the local store", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    expect(getMediaStore().kind).toBe("blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(getMediaStore().kind).toBe("local");
  });

  it("refuses the local store on Vercel", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "1");
    expect(() => getMediaStore()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
