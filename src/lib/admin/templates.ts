import type { Category } from "@/generated/prisma/client";
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

/** Built-ins in seed order, then saved templates oldest first. */
export async function listTemplates(): Promise<AdminTemplate[]> {
  const rows = await db.template.findMany({
    orderBy: [{ builtIn: "desc" }, { createdAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, builtIn: true, category: true, blocks: true, _count: { select: { posts: true } } },
  });
  return rows.map(({ blocks, _count, ...t }) => ({ ...t, outline: headingTexts(blocks as unknown[]), posts: _count.posts }));
}
