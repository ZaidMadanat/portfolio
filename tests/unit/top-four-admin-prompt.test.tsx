import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopFourAdminPrompt } from "@/features/reviews/TopFourAdminPrompt";

// The Reviews hub is static: the "Pick your top 4" prompt is decided in the
// browser, from /api/admin/session, so the page never reads cookies.

afterEach(() => vi.unstubAllGlobals());

const stubSession = (body: unknown, ok = true) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("TopFourAdminPrompt", () => {
  it("shows the admin a link to pick the top 4", async () => {
    const fetchMock = stubSession({ admin: true });
    render(<TopFourAdminPrompt kind="film" />);
    const link = await screen.findByRole("link", { name: /Pick your top 4 in the admin/ });
    expect(link).toHaveAttribute("href", "/admin/favourites");
    expect(screen.getByText("No top 4 films yet.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
  });

  it("shows visitors nothing", async () => {
    const fetchMock = stubSession({ admin: false });
    const { container } = render(<TopFourAdminPrompt kind="album" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the check fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
        throw new Error("offline");
      }));
    const { container } = render(<TopFourAdminPrompt kind="album" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
