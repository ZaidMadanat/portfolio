import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "./reset";

// Fixtures only: every Strava call goes through a mocked fetch. Nothing here
// may reach strava.com (agent-coordination: "No real Strava calls locally").

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ ...cache, unstable_cache: <T>(fn: T) => fn }));

const { getStravaAccessToken, syncStrava, StravaLocalGuardError, STRAVA_TOKEN_URL } = await import("@/lib/sync/strava");
const { SyncAuthError, SyncShapeError, SYNC_USER_AGENT } = await import("@/lib/sync/errors");

const activitiesFixture = () =>
  JSON.parse(readFileSync(new URL("../fixtures/strava-activities.json", import.meta.url), "utf8")) as Record<
    string,
    unknown
  >[];

const NOW = new Date("2026-10-29T13:20:00Z");
const now = () => NOW;
const inSeconds = (s: number) => new Date(NOW.getTime() + s * 1000);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Route = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** A fake Strava: the token endpoint and the activities endpoint. Unknown URLs fail the test. */
function fakeStrava({ token, activities }: { token?: Route; activities?: Route }) {
  return vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.href === STRAVA_TOKEN_URL && token) return token(url, init);
    if (url.origin + url.pathname === "https://www.strava.com/api/v3/athlete/activities" && activities)
      return activities(url, init);
    throw new Error(`unexpected request to ${url.href}`);
  });
}

const refreshed = (over: Record<string, unknown> = {}) =>
  json({
    token_type: "Bearer",
    access_token: "access-new",
    refresh_token: "refresh-new",
    expires_at: Math.floor(NOW.getTime() / 1000) + 21_600,
    expires_in: 21_600,
    ...over,
  });

const storeToken = (expiresAt: Date, refreshToken = "refresh-old") =>
  db.providerToken.create({ data: { provider: "strava", accessToken: "access-old", refreshToken, expiresAt } });

const storeActivity = (id: string, startAt: string, name = `Stored ${id}`) =>
  db.stravaActivity.create({
    data: { id, name, sportType: "Run", distanceM: 1000, movingS: 300, startAt: new Date(startAt), url: `https://www.strava.com/activities/${id}` },
  });

const tokenRow = () => db.providerToken.findUnique({ where: { provider: "strava" } });
const activityIds = async () => (await db.stravaActivity.findMany({ orderBy: { id: "asc" } })).map((a) => a.id);

beforeEach(async () => {
  await resetDb();
  cache.revalidateTag.mockClear();
  cache.updateTag.mockClear();
  vi.stubEnv("STRAVA_CLIENT_ID", "test-client");
  vi.stubEnv("STRAVA_CLIENT_SECRET", "test-secret");
  vi.stubEnv("STRAVA_REFRESH_TOKEN", "refresh-seed");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("STRAVA_ALLOW_LOCAL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getStravaAccessToken", () => {
  it("an expired token is refreshed, and the new refresh token, access token and expiry are saved", async () => {
    await storeToken(inSeconds(-60));
    const fetch = fakeStrava({ token: () => refreshed() });

    await expect(getStravaAccessToken({ fetch, db, now })).resolves.toBe("access-new");

    const row = await tokenRow();
    expect(row?.refreshToken).toBe("refresh-new");
    expect(row?.accessToken).toBe("access-new");
    expect(row?.expiresAt).toEqual(inSeconds(21_600));

    const [, init] = fetch.mock.calls[0];
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(String(init?.body));
    expect(Object.fromEntries(body)).toEqual({
      client_id: "test-client",
      client_secret: "test-secret",
      grant_type: "refresh_token",
      refresh_token: "refresh-old",
    });
    expect(new Headers(init?.headers).get("user-agent")).toBe(SYNC_USER_AGENT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("with no stored token, seeds from STRAVA_REFRESH_TOKEN and stores what the refresh returns", async () => {
    const fetch = fakeStrava({ token: () => refreshed() });
    await expect(getStravaAccessToken({ fetch, db, now })).resolves.toBe("access-new");
    expect(new URLSearchParams(String(fetch.mock.calls[0][1]?.body)).get("refresh_token")).toBe("refresh-seed");
    expect((await tokenRow())?.refreshToken).toBe("refresh-new");
  });

  it("saves the returned refresh token even when Strava hands back the same one", async () => {
    await storeToken(inSeconds(-60), "refresh-same");
    await getStravaAccessToken({ fetch: fakeStrava({ token: () => refreshed({ refresh_token: "refresh-same" }) }), db, now });
    const row = await tokenRow();
    expect([row?.refreshToken, row?.accessToken]).toEqual(["refresh-same", "access-new"]);
  });

  it("a token with more than an hour left is used as is; an hour or less is refreshed", async () => {
    await storeToken(inSeconds(3601));
    const fetch = fakeStrava({ token: () => refreshed() });
    await expect(getStravaAccessToken({ fetch, db, now })).resolves.toBe("access-old");
    expect(fetch).not.toHaveBeenCalled();

    await db.providerToken.update({ where: { provider: "strava" }, data: { expiresAt: inSeconds(3600) } });
    await expect(getStravaAccessToken({ fetch, db, now })).resolves.toBe("access-new");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("no stored token and no STRAVA_REFRESH_TOKEN rejects with SyncAuthError, without calling Strava", async () => {
    vi.stubEnv("STRAVA_REFRESH_TOKEN", "");
    const fetch = fakeStrava({ token: () => refreshed() });
    await expect(getStravaAccessToken({ fetch, db, now })).rejects.toBeInstanceOf(SyncAuthError);
    expect(fetch).not.toHaveBeenCalled();
    expect(await tokenRow()).toBeNull();
  });

  it.each([400, 401, 403])("a refresh answered %i (revoked) rejects with SyncAuthError and keeps the stored token", async (status) => {
    await storeToken(inSeconds(-60));
    const fetch = fakeStrava({ token: () => json({ message: "Bad Request", errors: [{ field: "refresh_token", code: "invalid" }] }, status) });
    await expect(getStravaAccessToken({ fetch, db, now })).rejects.toBeInstanceOf(SyncAuthError);
    expect((await tokenRow())?.refreshToken).toBe("refresh-old");
  });

  it("a refresh with an unexpected body rejects with SyncShapeError and keeps the stored token", async () => {
    await storeToken(inSeconds(-60));
    const fetch = fakeStrava({ token: () => json({ access_token: "only-this" }) });
    await expect(getStravaAccessToken({ fetch, db, now })).rejects.toBeInstanceOf(SyncShapeError);
    expect((await tokenRow())?.refreshToken).toBe("refresh-old");
  });

  it("error messages never carry a token or the client secret", async () => {
    await storeToken(inSeconds(-60));
    const err = await getStravaAccessToken({
      fetch: fakeStrava({ token: () => json({ message: "refresh-old test-secret" }, 401) }),
      db,
      now,
    }).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toMatch(/refresh-old|test-secret|access-old/);
  });
});

describe("syncStrava", () => {
  const validToken = () => storeToken(inSeconds(7200));

  it("stores only the 3 public activities (3 everyone + 1 followers_only + 1 only_me), mapped", async () => {
    await validToken();
    const fetch = fakeStrava({ activities: () => json(activitiesFixture()) });

    await expect(syncStrava({ fetch, db, now })).resolves.toEqual({ itemsChanged: 3 });

    const rows = await db.stravaActivity.findMany({ orderBy: { startAt: "desc" } });
    expect(rows.map((r) => [r.id, r.name, r.sportType, r.distanceM, r.movingS, r.startAt.toISOString(), r.url])).toEqual([
      ["16000000001", "Morning run along the Bay Trail", "Run", 8046.7, 2520, "2026-10-27T15:02:11.000Z", "https://www.strava.com/activities/16000000001"],
      ["16000000002", "Push day", "WeightTraining", 0, 3300, "2026-10-26T01:30:00.000Z", "https://www.strava.com/activities/16000000002"],
      // No sport_type: falls back to the legacy `type`.
      ["16000000003", "Tilden loop", "Hike", 11265.4, 9840, "2026-10-24T17:45:00.000Z", "https://www.strava.com/activities/16000000003"],
    ]);

    const [url, init] = fetch.mock.calls[0];
    const u = new URL(String(url));
    expect(u.searchParams.get("after")).toBe(String(Math.floor(NOW.getTime() / 1000) - 30 * 86_400));
    expect(u.searchParams.get("per_page")).toBe("100");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer access-old");
    expect(new Headers(init?.headers).get("user-agent")).toBe(SYNC_USER_AGENT);
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(cache.revalidateTag).toHaveBeenCalledTimes(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("home", "max");
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("refreshes an expired token first, saves the rotated one, then fetches with the new access token", async () => {
    await storeToken(inSeconds(-1));
    const fetch = fakeStrava({ token: () => refreshed(), activities: () => json(activitiesFixture()) });
    await syncStrava({ fetch, db, now });
    expect((await tokenRow())?.refreshToken).toBe("refresh-new");
    expect(new Headers(fetch.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer access-new");
  });

  it("a second identical run changes nothing", async () => {
    await validToken();
    const fetch = fakeStrava({ activities: () => json(activitiesFixture()) });
    await syncStrava({ fetch, db, now });
    await expect(syncStrava({ fetch, db, now })).resolves.toEqual({ itemsChanged: 0 });
    expect(await db.stravaActivity.count()).toBe(3);
  });

  it("an activity stored earlier that now comes back only_me is deleted; edits to public ones are applied", async () => {
    await validToken();
    const first = activitiesFixture();
    await syncStrava({ fetch: fakeStrava({ activities: () => json(first) }), db, now });

    const later = activitiesFixture();
    later[0] = { ...later[0], visibility: "only_me", private: true };
    later[1] = { ...later[1], name: "Push day (renamed)" };
    await expect(syncStrava({ fetch: fakeStrava({ activities: () => json(later) }), db, now })).resolves.toEqual({
      itemsChanged: 2,
    });
    expect(await activityIds()).toEqual(["16000000002", "16000000003"]);
    expect((await db.stravaActivity.findUniqueOrThrow({ where: { id: "16000000002" } })).name).toBe("Push day (renamed)");
  });

  it("a stored activity in the window that no longer comes back at all is deleted; older ones stay", async () => {
    await validToken();
    await storeActivity("15999999999", "2026-10-20T12:00:00Z"); // in the 30-day window, gone from Strava's list
    await storeActivity("15000000000", "2026-09-01T12:00:00Z"); // older than the window: not in the response by design
    await syncStrava({ fetch: fakeStrava({ activities: () => json(activitiesFixture()) }), db, now });
    expect(await activityIds()).toEqual(["15000000000", "16000000001", "16000000002", "16000000003"]);
  });

  it("a full page (100) deletes only what came back non-public, since the list may go on", async () => {
    await validToken();
    await storeActivity("15999999999", "2026-10-20T12:00:00Z");
    const base = activitiesFixture()[0];
    const page = Array.from({ length: 100 }, (_, i) => ({
      ...base,
      id: 17000000000 + i,
      visibility: i === 0 ? "only_me" : "everyone",
    }));
    await storeActivity("17000000000", "2026-10-27T15:02:11Z");
    await syncStrava({ fetch: fakeStrava({ activities: () => json(page) }), db, now });
    const ids = await activityIds();
    expect(ids).toContain("15999999999");
    expect(ids).not.toContain("17000000000");
    expect(ids).toHaveLength(100);
  });

  // Review Focus 4: a revoked grant never takes the previous data off the site.
  it("a refresh answered 401 (revoked) rejects with SyncAuthError and leaves the activities untouched", async () => {
    await storeToken(inSeconds(-60));
    await storeActivity("16000000001", "2026-10-27T15:02:11Z", "Kept");
    const fetch = fakeStrava({ token: () => json({ message: "Authorization Error" }, 401), activities: () => json([]) });

    await expect(syncStrava({ fetch, db, now })).rejects.toBeInstanceOf(SyncAuthError);
    expect(fetch).toHaveBeenCalledTimes(1); // never reached the activities endpoint
    expect(await db.stravaActivity.findMany()).toMatchObject([{ id: "16000000001", name: "Kept" }]);
    expect((await tokenRow())?.refreshToken).toBe("refresh-old");
  });

  it("an activities call answered 401 rejects with SyncAuthError and leaves the activities untouched", async () => {
    await validToken();
    await storeActivity("16000000001", "2026-10-27T15:02:11Z", "Kept");
    const fetch = fakeStrava({ activities: () => json({ message: "Authorization Error" }, 401) });
    await expect(syncStrava({ fetch, db, now })).rejects.toBeInstanceOf(SyncAuthError);
    expect(await db.stravaActivity.findMany()).toMatchObject([{ id: "16000000001", name: "Kept" }]);
  });

  it("a 500 or an unexpected body rejects and leaves the activities untouched", async () => {
    await validToken();
    await storeActivity("16000000001", "2026-10-27T15:02:11Z", "Kept");
    await expect(
      syncStrava({ fetch: fakeStrava({ activities: () => json({ message: "down" }, 500) }), db, now }),
    ).rejects.toThrow(/500/);
    await expect(
      syncStrava({ fetch: fakeStrava({ activities: () => json({ items: "nope" }) }), db, now }),
    ).rejects.toBeInstanceOf(SyncShapeError);
    await expect(
      syncStrava({ fetch: fakeStrava({ activities: () => new Response("<html>", { status: 200 }) }), db, now }),
    ).rejects.toBeInstanceOf(SyncShapeError);
    expect(await db.stravaActivity.findMany()).toMatchObject([{ id: "16000000001", name: "Kept" }]);
  });
});

// The real Strava API must never run from this machine by accident: a rotated
// refresh token would leave production's only seed (.env) dead.
describe("local guard", () => {
  it("refuses the real fetch off Vercel, before any request or write", async () => {
    const real = vi.fn<typeof globalThis.fetch>(async () => json([]));
    vi.stubGlobal("fetch", real);

    await expect(syncStrava({ db, now })).rejects.toBeInstanceOf(StravaLocalGuardError);
    await expect(syncStrava({ fetch: globalThis.fetch, db, now })).rejects.toBeInstanceOf(StravaLocalGuardError);
    await expect(getStravaAccessToken({ db, now })).rejects.toBeInstanceOf(StravaLocalGuardError);
    expect(real).not.toHaveBeenCalled();
    expect(await tokenRow()).toBeNull();
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ["VERCEL", "1"],
    ["STRAVA_ALLOW_LOCAL", "1"],
  ])("allows the global fetch when %s=%s (here a stub, never the network)", async (name, value) => {
    vi.stubEnv(name, value);
    await storeToken(inSeconds(7200));
    const stub = fakeStrava({ activities: () => json(activitiesFixture()) });
    vi.stubGlobal("fetch", stub);
    await expect(syncStrava({ db, now })).resolves.toEqual({ itemsChanged: 3 });
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("STRAVA_ALLOW_LOCAL must be exactly 1", async () => {
    vi.stubEnv("STRAVA_ALLOW_LOCAL", "true");
    vi.stubGlobal("fetch", vi.fn());
    await expect(syncStrava({ db, now })).rejects.toBeInstanceOf(StravaLocalGuardError);
  });
});
