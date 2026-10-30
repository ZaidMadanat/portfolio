import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv, requireEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseEnv", () => {
  it("accepts an empty environment (every var is optional at build time)", () => {
    expect(parseEnv({})).toEqual(expect.any(Object));
  });

  it("treats blank values as unset", () => {
    expect(parseEnv({ DIRECT_URL: "", RESEND_FROM: "  " })).toMatchObject({
      DIRECT_URL: undefined,
      RESEND_FROM: undefined,
    });
  });

  it("names invalid vars without echoing their values", () => {
    const bad = () => parseEnv({ ADMIN_GITHUB_ID: "zaid-secret-value", DATABASE_URL: "mysql://x" });
    expect(bad).toThrow(/ADMIN_GITHUB_ID/);
    expect(bad).toThrow(/DATABASE_URL/);
    expect(bad).not.toThrow(/zaid-secret-value/);
  });
});

describe("requireEnv", () => {
  it("returns a set value, read at call time", () => {
    vi.stubEnv("CRON_SECRET", "abc");
    expect(requireEnv("CRON_SECRET")).toBe("abc");
  });

  it("throws a clear error naming a missing or blank var", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(() => requireEnv("CRON_SECRET")).toThrow(
      /Missing required environment variable CRON_SECRET/,
    );
  });

  it("validates the value", () => {
    vi.stubEnv("ADMIN_GITHUB_ID", "not-a-number");
    expect(() => requireEnv("ADMIN_GITHUB_ID")).toThrow(/numeric/);
  });
});
