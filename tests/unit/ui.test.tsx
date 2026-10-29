import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlbumCover } from "@/components/ui/AlbumCover";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { PosterBlock } from "@/components/ui/PosterBlock";
import { RatingStamp } from "@/components/ui/RatingStamp";

describe("RatingStamp", () => {
  it('reads "9 out of 10" and shows "9/10"', () => {
    render(<RatingStamp rating={9} />);
    const stamp = screen.getByRole("img", { name: "9 out of 10" });
    expect(stamp).toHaveTextContent("9/10");
  });

  it("is tilted and wiggles", () => {
    render(<RatingStamp rating={7} />);
    const stamp = screen.getByRole("img", { name: "7 out of 10" });
    expect(stamp).toHaveClass("wiggle", "-rotate-8");
  });

  it("switches between dashed and filled", () => {
    const { rerender } = render(<RatingStamp rating={8} />);
    expect(screen.getByRole("img")).toHaveClass("border-dashed");
    rerender(<RatingStamp rating={8} variant="filled" />);
    expect(screen.getByRole("img")).not.toHaveClass("border-dashed");
    expect(screen.getByRole("img")).toHaveClass("bg-accent");
  });

  it('shows an "out of 10" caption when label is set', () => {
    render(<RatingStamp rating={10} size="lg" label />);
    const stamp = screen.getByRole("img", { name: "10 out of 10" });
    expect(stamp).toHaveTextContent("10out of 10");
  });
});

describe("Pill", () => {
  it("renders its children with the chosen tone", () => {
    render(<Pill tone="ink">Featured</Pill>);
    expect(screen.getByText("Featured")).toHaveClass("bg-ink");
  });
});

describe("Card", () => {
  it("renders the element given by `as`, with ink border and hard shadow", () => {
    render(
      <Card as="article" data-testid="card">
        Plateful
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("ARTICLE");
    expect(card).toHaveClass("border-ink", "shadow-hard");
    expect(card).not.toHaveClass("lift");
  });

  it("applies tilt and lift", () => {
    render(
      <Card tilt={-1.5} lift data-testid="card">
        Tilted
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("lift");
    expect(card.style.getPropertyValue("--tilt")).toBe("-1.5deg");
  });
});

describe("ButtonLink", () => {
  it("renders a link at least 44 px tall", () => {
    render(
      <ButtonLink href="/blog" variant="primary">
        Read the blog
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Read the blog" });
    expect(link).toHaveAttribute("href", "/blog");
    expect(link).toHaveClass("min-h-11", "bg-accent", "border-ink", "shadow-hard");
  });

  it("supports outline and ink variants", () => {
    render(
      <>
        <ButtonLink href="/reviews" variant="outline">
          Outline
        </ButtonLink>
        <ButtonLink href="/contact" variant="ink">
          Ink
        </ButtonLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Outline" })).not.toHaveClass("bg-accent");
    expect(screen.getByRole("link", { name: "Ink" })).toHaveClass("bg-ink");
  });
});

describe("PosterBlock", () => {
  it("shows the title when there is no poster", () => {
    render(<PosterBlock title="Ben-Hur" toneIndex={0} />);
    expect(screen.getByText("Ben-Hur")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Ben-Hur" })).toHaveClass("uppercase");
  });

  it("shows the poster image when posterUrl is set", () => {
    render(
      <PosterBlock title="Yojimbo" posterUrl="https://a.ltrbxd.com/yojimbo.jpg" toneIndex={1} />,
    );
    const img = screen.getByRole("img", { name: "Yojimbo" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://a.ltrbxd.com/yojimbo.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("cycles tones by toneIndex", () => {
    const tones = [0, 1, 2, 3, 4, 5].map((i) => {
      const { unmount } = render(<PosterBlock title={`T${i}`} toneIndex={i} />);
      const cls = screen.getByRole("img", { name: `T${i}` }).className;
      unmount();
      return cls.match(/\bbg-(ink|accent|second|soft2|soft)\b/)?.[1];
    });
    expect(tones).toEqual(["ink", "accent", "second", "soft2", "soft", "ink"]);
  });
});

describe("AlbumCover", () => {
  it("renders the cover image when coverUrl is set", () => {
    const { container } = render(
      <AlbumCover coverUrl="https://cdn.stats.fm/blonde.jpg" toneIndex={0} size="sm" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.stats.fm/blonde.jpg",
    );
  });

  it("renders a decorative tone block without a cover", () => {
    const { container } = render(<AlbumCover toneIndex={2} size="md" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it('renders a "Clear filters" link when given clearHref', () => {
    render(<EmptyState title="Nothing matches those filters." clearHref="/blog" />);
    expect(screen.getByText("Nothing matches those filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/blog");
  });

  it('renders a "Clear filters" button when given onClear', () => {
    const onClear = vi.fn();
    render(<EmptyState title="No places here yet." onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders no clear control when given neither", () => {
    render(<EmptyState title="Nothing yet." />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
