import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilmGrid } from "@/features/film/FilmGrid";
import type { FilmCard } from "@/lib/queries/films";

// A hand-entered FILM review (no Letterboxd log): its own rating, a REVIEW
// tag, a link to the published post, no stars, and no year when none was given.
const manual: FilmCard = {
  id: "review:r1",
  title: "Seen at the Castro",
  year: null,
  stars: null,
  rating: 8,
  watchedAt: "2026-04-22",
  posterUrl: null,
  href: "/blog/seen-at-the-castro",
  hasReview: true,
};

describe("FilmGrid, manual review card", () => {
  it("shows the rating, the REVIEW tag and the post link, without stars or a year", () => {
    render(<FilmGrid cards={[manual]} />);
    const item = screen.getByRole("listitem");
    expect(screen.getByRole("img", { name: "8 out of 10" })).toBeInTheDocument();
    expect(screen.getByTestId("review-tag")).toHaveTextContent(/review/i);
    expect(screen.getByRole("link", { name: "Seen at the Castro" })).toHaveAttribute("href", "/blog/seen-at-the-castro");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Seen at the Castro");
    expect(item).not.toHaveTextContent("★");
    expect(item).toHaveTextContent("Apr 22, 2026");
  });

  it("a year, when set, follows the title", () => {
    render(<FilmGrid cards={[{ ...manual, year: 1999 }]} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Seen at the Castro 1999");
  });
});
