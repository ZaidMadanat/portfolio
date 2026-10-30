import { UploadError } from "./errors";
import { MASTER_WIDTH } from "./urls";

export { UPLOAD_MESSAGES, UploadError, type UploadErrorCode } from "./errors";

// Browser half of the photo pipeline (spec §7.1). Decoding with the EXIF
// orientation applied, drawing on a canvas and re-encoding as WebP leaves no
// EXIF or GPS in the bytes that leave the browser, and keeps uploads well
// under Vercel's 4.5 MB request limit.

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const QUALITY = 0.85;

export async function clientResize(file: File): Promise<Blob> {
  // HEIC from non-Safari browsers (and anything else odd) lands here.
  if (!TYPES.has(file.type)) throw new UploadError("unsupported");
  if (file.size > MAX_INPUT_BYTES) throw new UploadError("too-large");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError("unsupported");
  }

  try {
    const scale = Math.min(1, MASTER_WIDTH / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UploadError("unsupported");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
    // A browser without WebP encoding falls back to PNG; the server re-encodes either way.
    return blob;
  } catch (err) {
    throw err instanceof UploadError ? err : new UploadError("unsupported");
  } finally {
    bitmap.close();
  }
}
