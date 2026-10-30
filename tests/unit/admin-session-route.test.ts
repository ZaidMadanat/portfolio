import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdmin = vi.fn();
vi.mock("@/lib/require-admin", () => ({ getAdmin }));

const { GET } = await import("@/app/api/admin/session/route");

beforeEach(() => getAdmin.mockReset());

describe("GET /api/admin/session", () => {
  it("says whether the visitor is the signed-in admin, and nothing else", async () => {
    getAdmin.mockResolvedValue({ userId: "u1", name: "Zaid", email: "z@example.com", image: null });
    const res = await GET();
    expect(await res.json()).toEqual({ admin: true });
    expect(res.headers.get("cache-control")).toBe("private, no-store");

    getAdmin.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ admin: false });
  });
});
