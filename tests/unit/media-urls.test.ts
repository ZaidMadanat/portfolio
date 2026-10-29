import { describe, expect, it } from "vitest";
import { mediaPath, mediaSrcSet, mediaUrl, variantWidths } from "@/lib/media/urls";

const BLOB = "https://abc123.public.blob.vercel-storage.com/media/cm1x2y3z/2400.webp";
const big = { blobUrl: BLOB, width: 2400 };
const small = { blobUrl: "/uploads/media/cm9/600.webp", width: 600 };

describe("media urls", () => {
  it("stores every photo under media/<id>/<width>.webp", () => {
    expect(mediaPath("cm1x2y3z", 960)).toBe("media/cm1x2y3z/960.webp");
    expect(() => mediaPath("../etc", 960)).toThrow();
    expect(() => mediaPath("cm1", 1.5)).toThrow();
  });

  it("lists the widths a photo has, from its stored width", () => {
    expect(variantWidths(2400)).toEqual([480, 960, 1600, 2400]);
    expect(variantWidths(1600)).toEqual([480, 960, 1600]);
    expect(variantWidths(600)).toEqual([480, 600]);
    expect(variantWidths(300)).toEqual([300]);
  });

  it("picks the smallest stored width that covers the request, else the largest", () => {
    expect(mediaUrl(big, 960)).toBe("https://abc123.public.blob.vercel-storage.com/media/cm1x2y3z/960.webp");
    expect(mediaUrl(big, 1000)).toBe("https://abc123.public.blob.vercel-storage.com/media/cm1x2y3z/1600.webp");
    expect(mediaUrl(small, 960)).toBe("/uploads/media/cm9/600.webp");
    expect(mediaUrl(small, 100)).toBe("/uploads/media/cm9/480.webp");
  });

  it("builds a srcset from the stored widths only", () => {
    expect(mediaSrcSet(small)).toBe("/uploads/media/cm9/480.webp 480w, /uploads/media/cm9/600.webp 600w");
    expect(mediaSrcSet(big).split(", ")).toHaveLength(4);
  });

  it("refuses a blobUrl that isn't in the media scheme", () => {
    expect(() => mediaUrl({ blobUrl: "https://example.com/x.jpg", width: 100 }, 100)).toThrow();
  });
});
