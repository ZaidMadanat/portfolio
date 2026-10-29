import type { Category } from "@/generated/prisma/enums";

export const BLOG_CATEGORIES = [
  "Notes",
  "Statistics",
  "Computer Science",
  "Philosophy",
  "Film",
  "Food",
  "Music",
  "Projects",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const LABELS: Record<Category, BlogCategory> = {
  NOTES: "Notes",
  STATISTICS: "Statistics",
  COMPUTER_SCIENCE: "Computer Science",
  PHILOSOPHY: "Philosophy",
  FILM: "Film",
  FOOD: "Food",
  MUSIC: "Music",
  PROJECTS: "Projects",
};

const BY_LABEL = new Map(
  (Object.entries(LABELS) as [Category, BlogCategory][]).map(([c, label]) => [label, c] as const),
);

/** The `Category` enum value's display label. */
export function categoryLabel(c: Category): BlogCategory {
  return LABELS[c];
}

/** Inverse of categoryLabel. */
export function categoryFromLabel(label: BlogCategory): Category {
  const c = BY_LABEL.get(label);
  if (!c) throw new Error(`Unknown blog category: ${label}`);
  return c;
}
