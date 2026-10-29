import { z } from "zod";
import { db } from "@/lib/db";
import { UploadError } from "@/lib/media/errors";
import { processImage } from "@/lib/media/process";
import { getMediaStore } from "@/lib/media/store";
import { mediaPath, mediaUrl, newMediaId } from "@/lib/media/urls";
import { AdminAuthError, requireAdmin, unauthorized } from "@/lib/require-admin";

// POST /api/admin/media (spec §7.1): one photo, already resized to WebP in the
// browser (src/lib/media/client-resize.ts). sharp re-encodes every size with no
// metadata, the sizes go to Blob as media/<id>/<width>.webp, and a Media row
// records the master. The original bytes are never stored.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The browser sends 2400 px WebP, far below this; Vercel rejects bodies over 4.5 MB anyway. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const formSchema = z.object({
  file: z.instanceof(File).refine((f) => f.size > 0, "empty"),
});

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** The original name for the photo library: no path, no control characters, at most 200 chars. */
function cleanFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-200);
  return clean || "photo";
}

export async function POST(request: Request) {
  try {
    await requireAdmin({ onFail: "throw" });
  } catch (err) {
    if (err instanceof AdminAuthError) return unauthorized();
    throw err;
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json(413, { error: "too-large", message: "That photo is over 4 MB after resizing. Export a smaller copy." });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "bad-request" });
  }
  const parsed = formSchema.safeParse({ file: form.get("file") });
  if (!parsed.success) return json(400, { error: "missing-file" });
  const { file } = parsed.data;
  if (file.size > MAX_UPLOAD_BYTES) {
    return json(413, { error: "too-large", message: "That photo is over 4 MB after resizing. Export a smaller copy." });
  }

  let image: Awaited<ReturnType<typeof processImage>>;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    if (err instanceof UploadError) return json(422, { error: err.code, message: err.message });
    throw err;
  }

  const id = newMediaId();
  const store = getMediaStore();
  try {
    const urls = await Promise.all(image.variants.map((v) => store.put(mediaPath(id, v.width), v.buf)));
    const master = image.variants[image.variants.length - 1];
    const media = await db.media.create({
      data: {
        id,
        blobUrl: urls[urls.length - 1],
        filename: cleanFilename(file.name),
        width: image.width,
        height: image.height,
        bytes: master.buf.length,
        blurDataUrl: image.blurDataUrl,
      },
    });
    return json(200, { id: media.id, url960: mediaUrl(media, 960), width: media.width, height: media.height });
  } catch (err) {
    // Don't leave orphaned sizes behind. Log the error type only.
    await store.remove(id).catch(() => {});
    console.error("Media upload failed:", err instanceof Error ? err.name : "unknown error");
    return json(500, { error: "error", message: "Upload failed. Try again." });
  }
}
