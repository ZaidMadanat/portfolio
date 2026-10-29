import type { Metadata } from "next";
import { Pill } from "@/components/ui/Pill";
import { ConfirmAction } from "@/features/admin/ConfirmAction";
import { listTemplates, type AdminTemplate } from "@/lib/admin/templates";
import { categoryLabel } from "@/lib/categories";
import { plural } from "@/lib/format";
import { requireAdmin } from "@/lib/require-admin";
import { deleteTemplate } from "./actions";

export const metadata: Metadata = { title: "Templates" };

// Templates (spec §7): the seven built-ins and any saved from a post. "New
// post" is a plain <a> to /admin/posts/new: that route creates a draft, so it
// must never be prefetched by the router.
export default async function TemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();
  const builtIn = templates.filter((t) => t.builtIn);
  const mine = templates.filter((t) => !t.builtIn);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold">Templates</h1>
        <p className="text-muted">Choosing one on a new post fills in its headings and category.</p>
      </div>

      <section aria-labelledby="built-in" className="flex flex-col gap-4">
        <h2 id="built-in" className="font-display text-2xl font-extrabold">
          Built-in
        </h2>
        <ul aria-label="Built-in templates" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {builtIn.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="yours" className="flex flex-col gap-4">
        <h2 id="yours" className="font-display text-2xl font-extrabold">
          Yours
        </h2>
        {mine.length > 0 ? (
          <ul aria-label="Your templates" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl border-2 border-dashed border-line p-5 text-muted">
            None saved yet. In any post&apos;s settings, use &quot;Save as a new template&quot;.
          </p>
        )}
      </section>
    </section>
  );
}

function TemplateCard({ template: t }: { template: AdminTemplate }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-3xl border-2 border-ink bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-xl font-extrabold break-words">{t.name}</h3>
        {t.category ? <Pill tone="soft">{categoryLabel(t.category)}</Pill> : null}
      </div>
      {t.outline.length > 0 ? (
        <ol aria-label={`${t.name} headings`} className="flex flex-wrap gap-1.5 text-sm">
          {t.outline.map((h, i) => (
            <li key={i} className="rounded-full bg-bg px-2.5 py-1 font-semibold text-muted">
              {h}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No headings.</p>
      )}
      <p className="text-sm text-muted">{t.posts > 0 ? `Started ${plural(t.posts, "post")}` : "Not used yet"}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <a
          href={`/admin/posts/new?template=${encodeURIComponent(t.id)}`}
          aria-label={`New post from ${t.name}`}
          className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-accent px-4 font-bold text-on-accent shadow-hard"
        >
          New post
        </a>
        {t.builtIn ? null : (
          <ConfirmAction
            action={deleteTemplate.bind(null, t.id)}
            label="Delete"
            ariaLabel={`Delete ${t.name}`}
            question="Delete this template? Posts started from it keep their content."
            confirmLabel="Yes, delete it"
            errorMessage="Couldn't delete this template. Reload and try again."
          />
        )}
      </div>
    </li>
  );
}
