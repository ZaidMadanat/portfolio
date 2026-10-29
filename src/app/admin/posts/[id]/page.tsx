import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostEditor } from "@/features/admin/editor/PostEditor";
import { getPostForEditor } from "@/lib/admin/posts";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = { title: "Edit post" };

// The post editor (spec §7). BlockNote itself loads in the browser only.
export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  await requireAdmin();
  const data = await getPostForEditor((await params).id);
  if (!data) notFound();
  return <PostEditor key={data.post.id} post={data.post} templates={data.templates} reviews={data.reviews} />;
}
