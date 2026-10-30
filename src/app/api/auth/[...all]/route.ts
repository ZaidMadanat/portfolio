import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's endpoints (sign-in, OAuth callback, session, sign-out). Dynamic,
// Node runtime.
export const { GET, POST } = toNextJsHandler(auth);
