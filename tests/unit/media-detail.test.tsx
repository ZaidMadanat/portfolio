import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@/lib/admin/media-library";

const actions = vi.hoisted(() => ({ updateAlt: vi.fn(), deleteMedia: vi.fn(), usageOf: vi.fn() }));
vi.mock("@/app/admin/media/actions", () => actions);

const { MediaDetail } = await import("@/features/admin/media/MediaDetail");

const item: MediaItem = {
  id: "c1",
  filename: "la-taqueria.jpg",
  thumbUrl: "/uploads/media/c1/480.webp",
  url: "/uploads/media/c1/2400.webp",
  width: 2400,
  height: 1600,
  bytes: 412_000,
  alt: "",
  createdAt: "2026-10-19T18:00:00.000Z",
  usedIn: [],
};

beforeEach(() => {
  actions.updateAlt.mockReset();
  actions.deleteMedia.mockReset();
});

describe("MediaDetail", () => {
  it("shows size, dimensions, date and usage", () => {
    render(<MediaDetail item={item} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "la-taqueria.jpg" })).toBeInTheDocument();
    expect(screen.getByText("402 KB · 2400 × 1600 · uploaded Oct 19, 2026")).toBeInTheDocument();
    expect(screen.getByText("Not used yet")).toBeInTheDocument();
  });

  it("blocks Delete while the photo is in use", () => {
    render(
      <MediaDetail item={{ ...item, usedIn: ["Review: La Taqueria", "Draft: Notes"] }} onSaved={vi.fn()} onDeleted={vi.fn()} />,
    );
    expect(screen.getByText("Review: La Taqueria")).toBeInTheDocument();
    const del = screen.getByRole("button", { name: "Delete" });
    expect(del).toBeDisabled();
    expect(del).toHaveAccessibleDescription("In use, so it can't be deleted. Remove it from the posts and reviews above first.");
  });

  it("deletes an unused photo after a confirmation", async () => {
    const onDeleted = vi.fn();
    actions.deleteMedia.mockResolvedValue(undefined);
    render(<MediaDetail item={item} onSaved={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(actions.deleteMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("c1"));
    expect(actions.deleteMedia).toHaveBeenCalledWith("c1");
  });

  it("saves alt text and reports failures", async () => {
    const onSaved = vi.fn();
    actions.updateAlt.mockResolvedValueOnce({ alt: "A burrito", postsUpdated: 2 });
    render(<MediaDetail item={item} onSaved={onSaved} onDeleted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "A burrito" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alt text" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Alt text saved. 2 posts updated."));
    expect(actions.updateAlt).toHaveBeenCalledWith("c1", "A burrito");
    expect(onSaved).toHaveBeenCalled();

    actions.updateAlt.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Save alt text" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the alt text. Try again."));
  });
});
