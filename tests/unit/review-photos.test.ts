import { describe, expect, it } from "vitest";
import { reviewPhotoAlt } from "@/lib/reviews/photos";

describe("reviewPhotoAlt", () => {
  it("uses the library's alt text, trimmed", () => {
    expect(reviewPhotoAlt("  Al pastor tacos on a tray ", "La Taqueria")).toBe("Al pastor tacos on a tray");
    expect(reviewPhotoAlt("Al pastor tacos", "La Taqueria", 3)).toBe("Al pastor tacos");
  });

  it("describes the place only when the alt text is blank", () => {
    expect(reviewPhotoAlt("", "La Taqueria")).toBe("Photo at La Taqueria");
    expect(reviewPhotoAlt("   ", "La Taqueria", 0)).toBe("Photo at La Taqueria");
    expect(reviewPhotoAlt(null, "La Taqueria", 1)).toBe("Photo 2 at La Taqueria");
  });
});
