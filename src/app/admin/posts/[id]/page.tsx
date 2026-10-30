import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/features/admin/ConfirmAction";
import { PostEditor } from "@/features/admin/editor/PostEditor";
import { getPostForEditor } from "@/lib/admin/posts";
import { requireAdmin } from "@/lib/require-admin";
import { deletePost } from "../actions";

export const metadata: Metadata = { title: "Edit post" };

// The post editor (spec §7). BlockNote itself loads in the browser only.
// Deleting the post here asks first, then goes back to the list.
export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  await requireAdmin();
  const data = await getPostForEditor((await params).id);
  if (!data) notFound();
  const { post } = data;
  const linked = post.reviewId !== null;
  return (
    <div className="flex flex-col gap-10">
      <PostEditor key={post.id} post={post} templates={data.templates} reviews={data.reviews} />
      <section
        aria-labelledby="delete-post-heading"
        className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-line p-5 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <h2 id="delete-post-heading" className="font-display text-xl font-bold">
            Delete this post
          </h2>
          <p className="text-sm text-muted">
            It comes off the site straight away, old links included. Its photos stay in the library
            {linked ? ", and its review stays, without the post." : "."}
          </p>
        </div>
        <ConfirmAction
          action={deletePost.bind(null, post.id)}
          label="Delete post"
          ariaLabel="Delete post"
          question={
            linked
              ? "Delete this post? This can't be undone. Its review stays."
              : "Delete this post? This can't be undone."
          }
          confirmLabel="Yes, delete it"
          errorMessage="Couldn't delete the post. Try again."
          redirectTo="/admin/posts"
        />
      </section>
    </div>
  );
}
