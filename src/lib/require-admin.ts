import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, isAdminUser } from "@/lib/auth";

// The real admin check (spec §7). Every admin server action, route handler and
// the admin layout call it; the proxy's cookie check is only an optimistic
// redirect. It re-reads the session from the database and re-checks the
// user's linked accounts against the allowlist on every request.

export const SIGN_IN_PATH = "/admin/sign-in";

export type AdminUser = { userId: string; name: string; email: string; image: string | null };

/** Thrown by `requireAdmin({onFail: 'throw'})`; route handlers turn it into a 401. */
export class AdminAuthError extends Error {
  constructor() {
    super("Admin session required");
    this.name = "AdminAuthError";
  }
}

/** The signed-in admin, or null. Cached for the length of one request. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !(await isAdminUser(session.user.id))) return null;
  const { id, name, email, image } = session.user;
  return { userId: id, name, email, image: image ?? null };
});

/**
 * Call first in every admin server action and route handler. Without an admin
 * session it redirects to the sign-in page, or with `onFail: 'throw'` (route
 * handlers) throws AdminAuthError.
 */
export async function requireAdmin({ onFail = "redirect" }: { onFail?: "redirect" | "throw" } = {}): Promise<{
  userId: string;
}> {
  const admin = await getAdmin();
  if (admin) return { userId: admin.userId };
  if (onFail === "throw") throw new AdminAuthError();
  redirect(SIGN_IN_PATH);
}

/** A JSON 401 for route handlers whose `requireAdmin({onFail: 'throw'})` failed. */
export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
