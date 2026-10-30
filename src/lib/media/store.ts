import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { del, list, put } from "@vercel/blob";

// Where photo sizes are written (spec §7.1). Vercel Blob when
// BLOB_READ_WRITE_TOKEN is set; otherwise, for local dev only, public/uploads
// (gitignored) with the same media/<id>/<width>.webp paths. `next dev` serves
// files added there; `next start` only serves what existed at build time.

export interface MediaStore {
  kind: "blob" | "local";
  /** Writes one size and returns its public URL. */
  put(path: string, body: Buffer): Promise<string>;
  /** Deletes every size of a photo. */
  remove(id: string): Promise<void>;
}

const PATH = /^media\/[A-Za-z0-9_-]{1,64}\/\d{1,5}\.webp$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function checkPath(path: string) {
  if (!PATH.test(path)) throw new Error("Invalid media path");
}
function checkId(id: string) {
  if (!ID.test(id)) throw new Error("Invalid media id");
}

const ONE_YEAR = 60 * 60 * 24 * 365;

export function blobStore(token: string): MediaStore {
  return {
    kind: "blob",
    async put(path, body) {
      checkPath(path);
      // Each photo gets a fresh id, so its URLs never change: cache for a year.
      const res = await put(path, body, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: ONE_YEAR,
        token,
      });
      return res.url;
    },
    async remove(id) {
      checkId(id);
      const { blobs } = await list({ prefix: `media/${id}/`, token });
      if (blobs.length > 0) await del(blobs.map((b) => b.url), { token });
    },
  };
}

// Turbopack's file tracing can't scope a runtime path, so it would trace the
// whole project (public/ included) into every server function that imports
// this module. The ignore comments opt these calls out: the local store only
// runs off Vercel (getMediaStore throws there) and never needs traced files.
// next.config.ts also excludes public/uploads from every trace.
function defaultRoot() {
  return join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
}

export function localStore(root = defaultRoot()): MediaStore {
  const base = resolve(/*turbopackIgnore: true*/ root);
  const inside = (path: string) => {
    const target = resolve(/*turbopackIgnore: true*/ base, path);
    if (!target.startsWith(base + sep)) throw new Error("Invalid media path");
    return target;
  };
  return {
    kind: "local",
    async put(path, body) {
      checkPath(path);
      const target = inside(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
      return `/uploads/${path}`;
    },
    async remove(id) {
      checkId(id);
      await rm(inside(`media/${id}`), { recursive: true, force: true });
    },
  };
}

export function getMediaStore(): MediaStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return blobStore(token);
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  return localStore();
}
