import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { PostSummary } from "@/lib/queries/posts";

// Two other posts (spec §6.3 item 5). Hidden when there are none.
export function KeepReading({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="keep-reading" className="flex flex-col gap-4">
      <h2 id="keep-reading" className="font-display text-3xl font-extrabold">
        Keep reading
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {posts.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <Card
              as={Link}
              href={`/blog/${p.slug}`}
              lift
              tilt={i % 2 ? 0.5 : -0.5}
              className="flex h-full flex-col gap-1.5 p-5"
            >
              <span className="text-[13px] text-muted">
                {p.category} · {p.readingMinutes} min read
              </span>
              <span className="font-display text-xl leading-tight font-extrabold">{p.title}</span>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
