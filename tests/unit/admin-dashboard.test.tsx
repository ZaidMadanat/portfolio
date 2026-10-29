import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayPart, greeting } from "@/lib/admin/greeting";

const actions = vi.hoisted(() => ({ runSyncNow: vi.fn() }));
vi.mock("@/app/admin/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { SyncStatus } = await import("@/features/admin/dashboard/SyncStatus");

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
] as const;

describe("SyncStatus", () => {
  beforeEach(() => actions.runSyncNow.mockReset());
  afterEach(() => router.refresh.mockReset());

  it("lists each source with its last run and a Run sync now button", () => {
    render(<SyncStatus rows={[...rows]} />);
    for (const r of rows) {
      expect(screen.getByRole("button", { name: `Run sync now for ${r.name}` })).toBeInTheDocument();
      expect(screen.getByText(r.detail)).toBeInTheDocument();
    }
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("runs the server action for that source and shows its message", async () => {
    actions.runSyncNow.mockResolvedValue({ ok: false, message: "Not wired yet" });
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for stats.fm" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("stats.fm: Not wired yet"));
    expect(actions.runSyncNow).toHaveBeenCalledWith("STATSFM");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refreshes the page after a successful run", async () => {
    actions.runSyncNow.mockResolvedValue({ ok: true, message: "3 changed" });
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for Strava" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("says so when the action itself fails", async () => {
    actions.runSyncNow.mockRejectedValueOnce(new Error("boom"));
    render(<SyncStatus rows={[...rows]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run sync now for Letterboxd" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Letterboxd: Couldn't start the sync. Try again."));
  });
});
