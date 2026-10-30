// Upload failures the admin sees (Review Focus 2). Shared by the browser resize
// step and the server pipeline, so both give the same message.

export const UPLOAD_MESSAGES = {
  unsupported: "Couldn't process this photo. Export it as JPEG and try again.",
  "too-large": "That photo is over 40 MB. Export a smaller copy.",
} as const;

export type UploadErrorCode = keyof typeof UPLOAD_MESSAGES;

export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode) {
    super(UPLOAD_MESSAGES[code]);
    this.name = "UploadError";
    this.code = code;
  }
}
