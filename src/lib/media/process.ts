import sharp from "sharp";
import { UploadError } from "./errors";
import { MEDIA_WIDTHS, variantWidths } from "./urls";

export { MEDIA_WIDTHS };

// Server half of the photo pipeline (spec §7.1). The browser already sent a
// WebP of 2400 px or less; this re-encodes it anyway, so nothing it carried
// survives. sharp drops all metadata (EXIF, GPS, XMP, IPTC, ICC) unless
// withMetadata/keepMetadata is called, and neither ever is here. rotate()
// applies the EXIF orientation first, so the pixels stay upright.

/** Inputs sharp may decode. Anything else (HEIC, SVG, TIFF...) gets the friendly error. */
const FORMATS = new Set(["jpeg", "png", "webp", "gif"]);
/** Decompression-bomb guard: well above any 2400 px upload. */
const MAX_INPUT_PIXELS = 50_000_000;
const QUALITY = 82;

export type ProcessedImage = {
  /** Ascending widths: those of MEDIA_WIDTHS below the master, then the master. */
  variants: { width: number; buf: Buffer }[];
  /** Master size. */
  width: number;
  height: number;
  /** A ~16 px WebP data URL for a blur-up placeholder. */
  blurDataUrl: string;
};

const open = (buf: Buffer) => sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

export async function processImage(buf: Buffer): Promise<ProcessedImage> {
  let width: number;
  try {
    const meta = await open(buf).metadata();
    if (!FORMATS.has(meta.format)) throw new UploadError("unsupported");
    width = meta.autoOrient.width;
  } catch {
    throw new UploadError("unsupported");
  }

  try {
    const base = open(buf).rotate();
    const variants = await Promise.all(
      variantWidths(width).map(async (w) => {
        const out = await base
          .clone()
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toBuffer({ resolveWithObject: true });
        return { width: out.info.width, height: out.info.height, buf: out.data };
      }),
    );
    const blur = await base.clone().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
    const master = variants[variants.length - 1];
    return {
      variants: variants.map(({ width: w, buf: b }) => ({ width: w, buf: b })),
      width: master.width,
      height: master.height,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  } catch {
    throw new UploadError("unsupported");
  }
}
