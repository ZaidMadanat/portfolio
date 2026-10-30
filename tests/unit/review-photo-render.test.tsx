import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingBox } from "@/features/blog/RatingBox";
import { PlaceCard } from "@/features/food/PlaceCard";
import type { Place } from "@/lib/queries/food";

const place: Place = {
  id: "p1",
  name: "La Taqueria",
  cuisine: "Mexican",
  price: 1,
  neighbourhood: "Mission",
  city: "San Francisco",
  region: "SAN_FRANCISCO",
  rating: 9,
  lat: 37.75,
  lng: -122.418,
  date: "2026-03-14",
  dishes: [{ name: "Carnitas burrito", mustOrder: true }],
  photos: [
    { url: "/uploads/media/a/960.webp", alt: "A carnitas burrito cut in half" },
    { url: "/uploads/media/b/960.webp", alt: "Photo 2 at La Taqueria" },
  ],
  postSlug: null,
};

describe("review photos", () => {
  it("PlaceCard renders each photo with its own alt text", () => {
    render(<PlaceCard place={place} />);
    expect(screen.getByRole("img", { name: "A carnitas burrito cut in half" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo 2 at La Taqueria" })).toBeInTheDocument();
  });

  it("RatingBox gives a review photo its alt text", () => {
    render(
      <RatingBox
        review={{
          kind: "FOOD",
          title: "La Taqueria",
          meta: "Mexican · $",
          rating: 9,
          imageUrl: "/uploads/media/a/2400.webp",
          imageAlt: "A carnitas burrito cut in half",
          href: "/reviews/food",
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "A carnitas burrito cut in half" })).toBeInTheDocument();
  });
});
