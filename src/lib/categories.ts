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
