import { afterEach, describe, expect, it, vi } from "vitest";
import { clientResize, UPLOAD_MESSAGES, UploadError } from "@/lib/media/client-resize";

// The browser half of the photo pipeline (spec §7.1). Node has File and Blob
// but no createImageBitmap/OffscreenCanvas, so those are stubbed per test.

afterEach(() => {
  vi.unstubAllGlobals();
});

const file = (type: string, bytes = 10, name = "photo") => new File([new Uint8Array(bytes)], name, { type });

async function codeOf(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(UploadError);
  return (err as UploadError).code;
}

/** Stubs the decoder and canvas; returns what the canvas was asked to do. */
function stubCanvas(width: number, height: number) {
  const calls = { size: [0, 0], drawn: [0, 0], blob: {} as { type?: string; quality?: number }, bitmapOpts: {} as unknown, closed: false };
  const bitmap = { width, height, close: () => (calls.closed = true) };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (_src: Blob, opts: unknown) => {
      calls.bitmapOpts = opts;
      return bitmap;
    }),
  );
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(w: number, h: number) {
        calls.size = [w, h];
      }
      getContext() {
        return {
          imageSmoothingQuality: "",
          drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => (calls.drawn = [w, h]),
        };
      }
      async convertToBlob(opts: { type: string; quality: number }) {
        calls.blob = opts;
        return new Blob([new Uint8Array(5)], { type: opts.type });
      }
    },
  );
  return calls;
}

describe("clientResize", () => {
  it("rejects HEIC (and anything but JPEG, PNG, WebP, GIF) as unsupported", async () => {
    stubCanvas(100, 100);
    expect(await codeOf(clientResize(file("image/heic", 10, "IMG_0001.HEIC")))).toBe("unsupported");
    for (const type of ["image/heif", "image/svg+xml", "image/tiff", "application/pdf", ""]) {
      expect(await codeOf(clientResize(file(type)))).toBe("unsupported");
    }
  });

  it("uses the plan's messages", async () => {
    const err = (await clientResize(file("image/heic")).catch((e: unknown) => e)) as UploadError;
    expect(err.message).toBe("Couldn't process this photo. Export it as JPEG and try again.");
    expect(UPLOAD_MESSAGES).toEqual({
      unsupported: "Couldn't process this photo. Export it as JPEG and try again.",
      "too-large": "That photo is over 40 MB. Export a smaller copy.",
    });
  });

  it("rejects inputs over 40 MB before decoding them", async () => {
    const calls = stubCanvas(100, 100);
    expect(await codeOf(clientResize(file("image/jpeg", 40 * 1024 * 1024 + 1)))).toBe("too-large");
    expect(calls.size).toEqual([0, 0]);
  });

  it("treats a file the browser can't decode as unsupported", async () => {
    stubCanvas(100, 100);
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("bad", "InvalidStateError")));
    expect(await codeOf(clientResize(file("image/jpeg")))).toBe("unsupported");
  });

  it("applies the EXIF orientation and downscales the long edge to 2400 as WebP 0.85", async () => {
    const calls = stubCanvas(4032, 3024);
    const out = await clientResize(file("image/jpeg"));
    expect(calls.bitmapOpts).toMatchObject({ imageOrientation: "from-image" });
    expect(calls.size).toEqual([2400, 1800]);
    expect(calls.drawn).toEqual([2400, 1800]);
    expect(calls.blob).toEqual({ type: "image/webp", quality: 0.85 });
    expect(out.type).toBe("image/webp");
    expect(calls.closed).toBe(true);
  });

  it("handles portrait photos by their long edge", async () => {
    const calls = stubCanvas(3024, 4032);
    await clientResize(file("image/png"));
    expect(calls.size).toEqual([1800, 2400]);
  });

  it("never upscales a small photo", async () => {
    const calls = stubCanvas(1000, 750);
    await clientResize(file("image/webp"));
    expect(calls.size).toEqual([1000, 750]);
  });
});
