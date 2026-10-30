import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// The ZM mark (src/app/icon.svg) and the files scripts/icons.mjs makes from it.
const APP = join(import.meta.dirname, "../../src/app");

describe("app icons", () => {
  it("icon.svg is the ZM mark: a tangerine rounded square tilted -6°, letters as paths", () => {
    const svg = readFileSync(join(APP, "icon.svg"), "utf8");
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toMatch(/rotate\(-6[ ,]/);
    expect(svg.toLowerCase()).toContain("#ff6b2c");
    expect(svg.toLowerCase()).toContain("#1c1a17");
    // No <text>: a favicon can't load the display font, so ZM is drawn.
    expect(svg).not.toContain("<text");
    expect(svg).toMatch(/aria-label="ZM"|<title>ZM<\/title>/);
  });

  it("apple-icon.png is a 180 px opaque square", async () => {
    const meta = await sharp(readFileSync(join(APP, "apple-icon.png"))).metadata();
    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([180, 180]);
    expect(meta.hasAlpha).toBe(false);
  });

  it("favicon.ico holds 16, 32 and 48 px PNG images", async () => {
    const ico = readFileSync(join(APP, "favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const size = ico.readUInt8(entry) || 256;
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      const png = ico.subarray(offset, offset + length);
      const meta = await sharp(png).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["png", size, size]);
      sizes.push(size);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });
});
