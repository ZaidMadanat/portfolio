"use client";

import { useCallback, useState } from "react";
import { clientResize } from "@/lib/media/client-resize";

// Admin photo upload (spec §7.1): resize and strip in the browser, then POST
// the WebP to /api/admin/media, which makes the sizes. The editor (Task 20),
// review form and photo library all go through uploadPhoto.

export type UploadedMedia = { id: string; url960: string; width: number; height: number };

const FAILED = "Upload failed. Try again.";

/** Resizes `file` in the browser and uploads it. Throws an Error whose message is ready to show. */
export async function uploadPhoto(file: File, fetcher: typeof fetch = fetch): Promise<UploadedMedia> {
  const resized = await clientResize(file); // UploadError messages are already friendly
  const form = new FormData();
  form.append("file", resized, file.name);

  let res: Response;
  try {
    res = await fetcher("/api/admin/media", { method: "POST", body: form });
  } catch {
    throw new Error(FAILED);
  }
  const body = (await res.json().catch(() => null)) as (UploadedMedia & { message?: string }) | null;
  if (res.ok && body) return body;
  if (res.status === 401) throw new Error("Your session ended. Sign in again.");
  throw new Error(typeof body?.message === "string" ? body.message : FAILED);
}

export type UploadStatus = "idle" | "uploading" | "done" | "error";

/** uploadPhoto with status and a displayable error, for drop zones. */
export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<UploadedMedia | null> => {
    setStatus("uploading");
    setError(null);
    try {
      const media = await uploadPhoto(file);
      setStatus("done");
      return media;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : FAILED);
      return null;
    }
  }, []);

  return { status, error, upload };
}
