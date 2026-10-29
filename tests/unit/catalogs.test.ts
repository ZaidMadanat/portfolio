import { describe, expect, it } from "vitest";
import { BLOG_CATEGORIES } from "@/lib/categories";
import { BASE_CUISINES } from "@/lib/cuisines";

describe("BASE_CUISINES", () => {
  it("is the 19 base cuisines in spec order", () => {
    expect(BASE_CUISINES).toEqual([
      "American", "Bakery", "Burgers", "Burmese", "Californian", "Chinese",
      "Coffee & Dessert", "Ethiopian", "Indian", "Italian", "Japanese", "Korean",
      "Mediterranean", "Mexican", "Middle Eastern", "Pizza", "Seafood", "Thai", "Vietnamese",
    ]);
  });
});

describe("BLOG_CATEGORIES", () => {
  it("is the fixed category list", () => {
    expect(BLOG_CATEGORIES).toEqual([
      "Notes", "Statistics", "Computer Science", "Philosophy", "Film", "Food", "Music", "Projects",
    ]);
  });
});
