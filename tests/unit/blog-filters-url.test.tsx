import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostSummary } from "@/lib/queries/posts";

// useSearchParams can lag a moment behind window.history.replaceState (Next
// syncs it asynchronously). Here it never catches up, so every change must
// build on the live URL, not on the possibly stale params.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const { BlogFilters } = await import("@/features/blog/BlogFilters");

const post: PostSummary = {
  id: "p1",
  slug: "median",
  title: "Why the median beats the mean",
  excerpt: "",
  category: "Statistics",
  tags: ["statistics"],
  publishedAt: "2026-04-01T12:00:00.000Z",
  year: "2026",
  readingMinutes: 4,
  rating: null,
};

afterEach(() => window.history.replaceState(null, "", "/blog"));

describe("BlogFilters URL", () => {
  it("keeps the category when a tag is picked straight after it", () => {
    window.history.replaceState(null, "", "/blog");
    render(<BlogFilters posts={[post]} />);
    fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
    expect(window.location.search).toBe("?cat=Statistics");
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "statistics" } });
    expect(window.location.search).toBe("?cat=Statistics&tag=statistics");
  });
});
