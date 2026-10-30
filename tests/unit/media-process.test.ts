import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { UploadError } from "@/lib/media/errors";
import { MEDIA_WIDTHS, processImage } from "@/lib/media/process";

// Review Focus 2: a phone photo with GPS must come out with no metadata at all,
// and odd inputs get the friendly "export as JPEG" error.

const GPS = { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 46/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "122/1 25/1 0/1" } };

function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 107, b: 44 } } });
}

async function gpsJpeg(width: number, height: number, orientation?: number) {
  return photo(width, height)
    .jpeg()
    .withMetadata({ exif: GPS, ...(orientation ? { orientation } : {}) })
    .toBuffer();
}

describe("processImage", () => {
  it("makes 480, 960, 1600 and 2400 px WebPs from a large photo", async () => {
    expect(MEDIA_WIDTHS).toEqual([480, 960, 1600, 2400]);
    const res = await processImage(await gpsJpeg(3000, 2000));
    expect(res.variants.map((v) => v.width)).toEqual([480, 960, 1600, 2400]);
    expect(res.width).toBe(2400);
    expect(res.height).toBe(1600);
    for (const v of res.variants) {
      const meta = await sharp(v.buf).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(v.width);
      expect(meta.height).toBe(Math.round((v.width * 2000) / 3000));
    }
  });

  it("strips every bit of metadata, GPS included, from every variant", async () => {
    const input = await gpsJpeg(3000, 2000);
    const before = await sharp(input).metadata();
    expect(before.exif, "the fixture must carry EXIF").toBeDefined();
    // ...including the GPS block: it's longer than the same photo's EXIF without one.
    const plain = await sharp(await photo(3000, 2000).jpeg().withMetadata().toBuffer()).metadata();
    expect(before.exif!.length).toBeGreaterThan(plain.exif!.length);

    const { variants, blurDataUrl } = await processImage(input);
    const blur = Buffer.from(blurDataUrl.replace(/^data:image\/webp;base64,/, ""), "base64");
    for (const buf of [...variants.map((v) => v.buf), blur]) {
      const meta = await sharp(buf).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });

  it("never upscales: a 600 px photo gives only 480 plus the original 600", async () => {
    const res = await processImage(await gpsJpeg(600, 400));
    expect(res.variants.map((v) => v.width)).toEqual([480, 600]);
    expect(res.width).toBe(600);
    expect(res.height).toBe(400);
    expect((await sharp(res.variants[1].buf).metadata()).width).toBe(600);
  });

  it("a photo that's exactly a variant width isn't duplicated", async () => {
    const res = await processImage(await photo(960, 640).png().toBuffer());
    expect(res.variants.map((v) => v.width)).toEqual([480, 960]);
  });

  it("applies the EXIF orientation before stripping it", async () => {
    // Stored 300x200, orientation 6 = rotate 90 degrees clockwise to display.
    const res = await processImage(await gpsJpeg(300, 200, 6));
    expect(res.width).toBe(200);
    expect(res.height).toBe(300);
    const meta = await sharp(res.variants.at(-1)!.buf).metadata();
    expect([meta.width, meta.height]).toEqual([200, 300]);
  });

  it("returns a tiny WebP blur placeholder", async () => {
    const { blurDataUrl } = await processImage(await gpsJpeg(3000, 2000));
    expect(blurDataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    expect(blurDataUrl.length).toBeLessThan(1000);
  });

  it("rejects bytes that aren't a JPEG, PNG, WebP or GIF with the friendly error", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const tiff = await photo(10, 10).tiff().toBuffer();
    for (const buf of [Buffer.from("not an image"), svg, tiff, Buffer.alloc(0)]) {
      const err = await processImage(buf).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UploadError);
      expect((err as UploadError).code).toBe("unsupported");
      expect((err as UploadError).message).toBe("Couldn't process this photo. Export it as JPEG and try again.");
    }
  });
});
