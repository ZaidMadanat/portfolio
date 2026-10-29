import type { Category, Prisma } from "@/generated/prisma/client";
import { headingTexts } from "@/lib/blocks/render";
import { db } from "@/lib/db";

// The templates admin page's reads (spec §7). Callers check the admin session.

export type AdminTemplate = {
  id: string;
  name: string;
  builtIn: boolean;
  category: Category | null;
  /** The template's headings, in order. */
  outline: string[];
  /** Posts started from it. */
  posts: number;
};

/**
 * Built-ins in spec order (seeded `sortOrder` 1–7), then saved templates
 * (`sortOrder` 1000) oldest first. Ends on `id` so the order is total even when
 * rows share a `createdAt`. Every template list and picker uses this.
 */
export const TEMPLATE_ORDER = [
  { builtIn: "desc" },
  { sortOrder: "asc" },
  { createdAt: "asc" },
  { name: "asc" },
  { id: "asc" },
] satisfies Prisma.TemplateOrderByWithRelationInput[];

export async function listTemplates(): Promise<AdminTemplate[]> {
  const rows = await db.template.findMany({
    orderBy: TEMPLATE_ORDER,
    select: { id: true, name: true, builtIn: true, category: true, blocks: true, _count: { select: { posts: true } } },
  });
  return rows.map(({ blocks, _count, ...t }) => ({ ...t, outline: headingTexts(blocks as unknown[]), posts: _count.posts }));
}
