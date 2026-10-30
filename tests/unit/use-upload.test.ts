import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadError } from "@/lib/media/errors";

const clientResize = vi.fn();
vi.mock("@/lib/media/client-resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/media/client-resize")>()),
  clientResize,
}));

const { uploadPhoto } = await import("@/features/admin/useUpload");

const file = new File([new Uint8Array(3)], "IMG_7.jpg", { type: "image/jpeg" });
const resized = new Blob([new Uint8Array(2)], { type: "image/webp" });
const reply = (status: number, body: unknown) => vi.fn(async () => Response.json(body, { status }));

beforeEach(() => {
  clientResize.mockReset();
  clientResize.mockResolvedValue(resized);
});

describe("uploadPhoto", () => {
  it("resizes in the browser, then posts only the resized WebP under the original name", async () => {
    const media = { id: "c1", url960: "/uploads/media/c1/960.webp", width: 2400, height: 1600 };
    const fetcher = reply(200, media);
    await expect(uploadPhoto(file, fetcher)).resolves.toEqual(media);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/media");
    const sent = (init.body as FormData).get("file") as File;
    expect(sent.name).toBe("IMG_7.jpg");
    expect(sent.type).toBe("image/webp");
    expect(sent.size).toBe(2);
  });

  it("passes the browser's friendly error through without uploading", async () => {
    clientResize.mockRejectedValue(new UploadError("unsupported"));
    const fetcher = reply(200, {});
    await expect(uploadPhoto(file, fetcher)).rejects.toThrow("Couldn't process this photo. Export it as JPEG and try again.");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows the server's message, and a clear one for an expired session", async () => {
    await expect(uploadPhoto(file, reply(422, { error: "unsupported", message: "Couldn't process this photo. Export it as JPEG and try again." }))).rejects.toThrow(
      "Couldn't process this photo. Export it as JPEG and try again.",
    );
    await expect(uploadPhoto(file, reply(401, { error: "unauthorized" }))).rejects.toThrow("Your session ended. Sign in again.");
    await expect(uploadPhoto(file, reply(502, "bad gateway"))).rejects.toThrow("Upload failed. Try again.");
    await expect(uploadPhoto(file, vi.fn().mockRejectedValue(new TypeError("offline")))).rejects.toThrow("Upload failed. Try again.");
  });
});
