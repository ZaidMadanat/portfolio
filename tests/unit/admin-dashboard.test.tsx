import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayPart, greeting } from "@/lib/admin/greeting";

const actions = vi.hoisted(() => ({ runSyncNow: vi.fn() }));
vi.mock("@/app/admin/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { SyncStatus } = await import("@/features/admin/dashboard/SyncStatus");
const { StatTiles } = await import("@/features/admin/dashboard/StatTiles");

// Pacific time: PDT (UTC-7) on 2026-10-29.
const at = (pacificHour: number) => new Date(Date.UTC(2026, 9, 29, pacificHour + 7, 30));

describe("greeting", () => {
  it("follows the time of day in Los Angeles", () => {
    expect(dayPart(at(5))).toBe("Morning");
    expect(dayPart(at(11))).toBe("Morning");
    expect(dayPart(at(12))).toBe("Afternoon");
    expect(dayPart(at(16))).toBe("Afternoon");
    expect(dayPart(at(17))).toBe("Evening");
    expect(dayPart(at(23))).toBe("Evening");
    expect(dayPart(at(2))).toBe("Evening");
    expect(greeting(at(8))).toBe("Morning, Zaid.");
  });

  it("uses Los Angeles time, not the server's UTC", () => {
    // 15:00 UTC is 08:00 in Los Angeles.
    expect(greeting(new Date("2026-10-29T15:00:00Z"))).toBe("Morning, Zaid.");
  });
});

const rows = [
  { source: "LETTERBOXD", name: "Letterboxd", ok: true, detail: "Oct 29, 6:00 AM · 3 changed" },
  { source: "STATSFM", name: "stats.fm", ok: false, detail: "Oct 29, 6:00 AM · failed: stats.fm returned 500" },
  { source: "STRAVA", name: "Strava", ok: null, detail: "Never run" },
  { source: "HOUSEKEEPING", name: "Housekeeping", ok: true, detail: "Oct 29, 6:30 AM · 2 changed" },
] as const;

describe("SyncStatus", () => {
  beforeEach(() => actions.runSyncNow.mockReset());
  afterEach(() => router.refresh.mockReset());

  it("lists each source with its last run and a Run sync now button (Run now for housekeeping)", () => {
    render(<SyncStatus rows={[...rows]} />);
    for (const r of rows) {
      const button = r.source === "HOUSEKEEPING" ? "Run now" : "Run sync now";
      expect(screen.getByRole("button", { name: `${button} for ${r.name}` })).toBeInTheDocument();
      expect(screen.getByText(r.detail)).toBeInTheDocument();
    }
    expect(screen.getAllByText("OK")).toHaveLength(2);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("runs the server action for that source, shows its message and refreshes (a failed run is logged too)", async () => {
    actions.runSyncNow.mockResolvedValue({ ok: false, message: "stats.fm responded 500" });
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for stats.fm" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("stats.fm: stats.fm responded 500"));
    expect(actions.runSyncNow).toHaveBeenCalledWith("STATSFM");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("refreshes the page after a successful run", async () => {
    actions.runSyncNow.mockResolvedValue({ ok: true, message: "3 changed" });
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for Strava" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("housekeeping has a Run now button that runs it", async () => {
    actions.runSyncNow.mockResolvedValue({ ok: true, message: "Done · 1 counters changed · 0 emails sent" });
    render(<SyncStatus rows={[...rows]} />);
    expect(screen.queryByRole("button", { name: "Run sync now for Housekeeping" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run now for Housekeeping" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Housekeeping: Done · 1 counters changed · 0 emails sent"),
    );
    expect(actions.runSyncNow).toHaveBeenCalledWith("HOUSEKEEPING");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("says so when the action itself fails", async () => {
    actions.runSyncNow.mockRejectedValueOnce(new Error("boom"));
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for Letterboxd" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Letterboxd: Couldn't start the sync. Try again."));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("StatTiles views", () => {
  const stats = (views: Parameters<typeof StatTiles>[0]["stats"]["views"]) => ({
    published: 1,
    drafts: 0,
    reviews: { total: 0, FOOD: 0, FILM: 0, ALBUM: 0, CONCERT: 0 },
    confirmedSubscribers: 0,
    views,
  });
  const viewsTile = () => screen.getAllByRole("listitem").find((li) => li.textContent?.startsWith("Views"))!;
  const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("shows the last 30 days when there's a full window", () => {
    render(<StatTiles stats={stats({ recent: 1234, since: utc("2026-09-29"), full: true, countedAt: utc("2026-10-29") })} />);
    expect(viewsTile().textContent).toBe("Views1,234last 30 days");
  });

  it("says 'since <date>' when history is shorter than 30 days", () => {
    render(<StatTiles stats={stats({ recent: 40, since: utc("2026-10-20"), full: false, countedAt: utc("2026-10-29") })} />);
    expect(viewsTile().textContent).toBe("Views40since Oct 20, 2026");
  });

  it("says 'not counted yet' before the first housekeeping run", () => {
    render(<StatTiles stats={stats({ recent: 0, since: null, full: false, countedAt: null })} />);
    expect(viewsTile().textContent).toBe("Views0not counted yet");
  });
});
