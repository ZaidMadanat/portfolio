import { createDraft } from "@/lib/admin/posts";
import { AdminAuthError, requireAdmin, SIGN_IN_PATH } from "@/lib/require-admin";

// GET /admin/posts/new?template=<id>: creates a draft (pre-filled from the
// template, if any) and opens it in the editor. Link to it with a plain <a>,
// not next/link: a router prefetch must never create a post, so prefetches get
// an empty 204 here.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (request.headers.get("next-router-prefetch")) return new Response(null, { status: 204 });
  try {
    await requireAdmin({ onFail: "throw" });
  } catch (err) {
    if (err instanceof AdminAuthError) return Response.redirect(new URL(SIGN_IN_PATH, request.url), 303);
    throw err;
  }
  const template = new URL(request.url).searchParams.get("template");
  const post = await createDraft(template && template.length <= 64 ? template : null);
  return Response.redirect(new URL(`/admin/posts/${post.id}`, request.url), 303);
}
