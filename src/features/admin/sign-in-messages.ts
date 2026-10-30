import { NOT_ADMIN, NOT_ADMIN_MESSAGE } from "@/lib/auth-policy";

/** The sign-in page's message for a Better Auth error code (from `?error=` or a client call). */
export function signInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return code === NOT_ADMIN ? NOT_ADMIN_MESSAGE : "Sign-in didn't work. Try again.";
}
