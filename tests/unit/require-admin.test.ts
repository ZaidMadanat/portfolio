import { beforeEach, describe, expect, it, vi } from "vitest";

// requireAdmin re-checks the session on every admin action and route; the
// proxy's cookie check is only an optimistic redirect.

const getSession = vi.fn();
const isAdminUser = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "x=1" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } }, isAdminUser }));

const { AdminAuthError, requireAdmin } = await import("@/lib/require-admin");

const session = { user: { id: "u1", name: "Zaid", email: "z@example.com", image: null }, session: { id: "s1" } };

beforeEach(() => {
  getSession.mockReset();
  isAdminUser.mockReset();
});

describe("requireAdmin", () => {
  it("returns the user id for an admin session", async () => {
    getSession.mockResolvedValue(session);
    isAdminUser.mockResolvedValue(true);
    await expect(requireAdmin()).resolves.toEqual({ userId: "u1" });
    expect(isAdminUser).toHaveBeenCalledWith("u1");
  });

  it("redirects to /admin/sign-in without a session", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ url: "/admin/sign-in" });
  });

  it("redirects a session whose user is no longer the admin", async () => {
    getSession.mockResolvedValue(session);
    isAdminUser.mockResolvedValue(false);
    await expect(requireAdmin()).rejects.toMatchObject({ url: "/admin/sign-in" });
  });

  it("throws AdminAuthError instead of redirecting in route handlers", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin({ onFail: "throw" })).rejects.toBeInstanceOf(AdminAuthError);
    getSession.mockResolvedValue(session);
    isAdminUser.mockResolvedValue(false);
    await expect(requireAdmin({ onFail: "throw" })).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("never grants access when the session lookup throws", async () => {
    getSession.mockRejectedValue(new Error("db down"));
    await expect(requireAdmin({ onFail: "throw" })).rejects.toThrow("db down");
  });
});
