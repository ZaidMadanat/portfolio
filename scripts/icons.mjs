// Makes the raster app icons from the ZM mark, src/app/icon.svg:
//   src/app/apple-icon.png  180 px, opaque (iOS fills transparency with black)
//   src/app/favicon.ico     16, 32 and 48 px PNGs in one ICO
// Run after editing the SVG: `node scripts/icons.mjs`. Next serves all three
// from src/app by file convention.

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const APP = new URL("../src/app/", import.meta.url);
const svg = readFileSync(new URL("icon.svg", APP));
// Citrus Pop light bg (spec §5).
const BG = "#fff8e7";

/** The mark rendered square at `size` px, transparent around it. */
const mark = (size) => sharp(svg, { density: Math.ceil((72 * size) / 64) * 4 }).resize(size, size).png().toBuffer();

// Apple touch icon: the mark at 150 px on the site background.
// sharp composites last, so flatten in a second pass to drop the alpha channel.
const composed = await sharp({ create: { width: 180, height: 180, channels: 3, background: BG } })
  .composite([{ input: await mark(150), gravity: "centre" }])
  .png()
  .toBuffer();
const apple = await sharp(composed).flatten({ background: BG }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
writeFileSync(new URL("apple-icon.png", APP), apple);

// favicon.ico: ICONDIR + one ICONDIRENTRY per size, then the PNG bytes.
const SIZES = [16, 32, 48];
const pngs = await Promise.all(SIZES.map((s) => mark(s)));
const header = Buffer.alloc(6 + 16 * SIZES.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(SIZES.length, 4);
let offset = header.length;
SIZES.forEach((size, i) => {
  const entry = 6 + i * 16;
  header.writeUInt8(size, entry); // width
  header.writeUInt8(size, entry + 1); // height
  header.writeUInt8(0, entry + 2); // no palette
  header.writeUInt8(0, entry + 3); // reserved
  header.writeUInt16LE(1, entry + 4); // colour planes
  header.writeUInt16LE(32, entry + 6); // bits per pixel
  header.writeUInt32LE(pngs[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += pngs[i].length;
});
writeFileSync(new URL("favicon.ico", APP), Buffer.concat([header, ...pngs]));

console.log("wrote src/app/apple-icon.png and src/app/favicon.ico");
