import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getMusic } from "@/lib/queries/music";
import { resetDb } from "./reset";

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

const { syncStatsfm } = await import("@/lib/sync/statsfm");
const { SyncShapeError, SYNC_USER_AGENT } = await import("@/lib/sync/errors");

const fixture = () => readFileSync(new URL("../fixtures/statsfm-top-albums.json", import.meta.url), "utf8");
const NOW = new Date("2026-10-29T13:10:00Z");
const now = () => NOW;

/** A fetch that serves `body` with `status` and records each call. */
const fakeFetch = (body: string, status = 200) =>
  vi.fn<typeof globalThis.fetch>(async () => new Response(body, { status, headers: { "content-type": "application/json" } }));

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Last week's six rows, as a previous sync left them. */
async function seedPrevious() {
  await db.albumListen.createMany({
    data: [1, 2, 3, 4, 5, 6].map((rank) => ({
      id: `old${rank}`,
      statsfmAlbumId: `s${rank}`,
      title: `Old album ${rank}`,
      artist: "Old artist",
      year: 2020,
      coverUrl: "",
      rank,
      streams: 10 - rank,
      windowStart: day("2026-10-15"),
      windowEnd: day("2026-10-22"),
    })),
  });
}

const rowIds = async () => (await db.albumListen.findMany({ orderBy: { rank: "asc" } })).map((r) => r.id);
const OLD_IDS = ["old1", "old2", "old3", "old4", "old5", "old6"];

beforeEach(async () => {
  await resetDb();
  cache.revalidateTag.mockClear();
  cache.updateTag.mockClear();
});

describe("syncStatsfm", () => {
  it("replaces last week's rows with the real response and revalidates music + home ('max')", async () => {
    await seedPrevious();
    const fetch = fakeFetch(fixture());

    await expect(syncStatsfm({ fetch, db, now })).resolves.toEqual({ itemsChanged: 6 });

    const rows = await db.albumListen.findMany({ orderBy: { rank: "asc" } });
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.some((r) => r.id.startsWith("old"))).toBe(false);
    expect(rows[0]).toMatchObject({ title: "LUX", artist: "ROSALÍA", year: 2025, statsfmAlbumId: "59524021", streams: 50 });
    for (const r of rows) {
      expect(r.windowStart).toEqual(new Date("2026-10-22T13:10:00Z"));
      expect(r.windowEnd).toEqual(NOW);
    }

    expect(cache.revalidateTag).toHaveBeenCalledTimes(2);
    for (const tag of ["music", "home"]) expect(cache.revalidateTag).toHaveBeenCalledWith(tag, "max");
    expect(cache.updateTag).not.toHaveBeenCalled();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.stats.fm/api/v1/users/maday/top/albums?after=1792674600000&before=1793279400000&limit=6",
    );
    expect(new Headers(init?.headers).get("user-agent")).toBe(SYNC_USER_AGENT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // Review Focus 4: a failing source never takes the previous data off the site.
  it("a 500 rejects and leaves the existing 6 rows untouched", async () => {
    await seedPrevious();
    await expect(syncStatsfm({ fetch: fakeFetch("oops", 500), db, now })).rejects.toThrow(/500/);
    expect(await rowIds()).toEqual(OLD_IDS);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
    expect((await getMusic()).rotation.map((a) => a.title)).toEqual(OLD_IDS.map((_, i) => `Old album ${i + 1}`));
  });

  it("{items: 'nope'} rejects with SyncShapeError and leaves the rows untouched", async () => {
    await seedPrevious();
    await expect(
      syncStatsfm({ fetch: fakeFetch(JSON.stringify({ items: "nope" })), db, now }),
    ).rejects.toBeInstanceOf(SyncShapeError);
    expect(await rowIds()).toEqual(OLD_IDS);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("a body that isn't JSON rejects with SyncShapeError and leaves the rows untouched", async () => {
    await seedPrevious();
    await expect(syncStatsfm({ fetch: fakeFetch("<html>maintenance</html>"), db, now })).rejects.toBeInstanceOf(
      SyncShapeError,
    );
    expect(await rowIds()).toEqual(OLD_IDS);
  });

  it("a network error or timeout rejects and leaves the rows untouched", async () => {
    await seedPrevious();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(syncStatsfm({ fetch, db, now })).rejects.toThrow(/timeout/);
    expect(await rowIds()).toEqual(OLD_IDS);
  });

  it("an empty week keeps the previous snapshot and changes nothing", async () => {
    await seedPrevious();
    await expect(syncStatsfm({ fetch: fakeFetch(JSON.stringify({ items: [] })), db, now })).resolves.toEqual({
      itemsChanged: 0,
    });
    expect(await rowIds()).toEqual(OLD_IDS);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("a failed write leaves the old rows in place", async () => {
    await seedPrevious();
    const body = JSON.parse(fixture()) as { items: { streams: number }[] };
    body.items[5].streams = 2 ** 40; // overflows AlbumListen.streams (Int4) inside the transaction
    await expect(syncStatsfm({ fetch: fakeFetch(JSON.stringify(body)), db, now })).rejects.toThrow();
    expect(await rowIds()).toEqual(OLD_IDS);
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });
});
