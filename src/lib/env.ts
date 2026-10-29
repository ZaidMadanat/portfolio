import { z } from "zod";

// Server env (spec §10), validated once at import. Every server-only var is
// optional here so builds and unit tests run without secrets; code that needs
// one calls requireEnv(name) at the point of use. Values are never logged.

/** Unset and blank (`FOO=`) both mean "not provided". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

const str = optional(z.string());
const url = optional(z.url());
const pgUrl = optional(z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"));

const envSchema = z.object({
  DATABASE_URL: pgUrl,
  DIRECT_URL: pgUrl,
  BETTER_AUTH_SECRET: str,
  BETTER_AUTH_URL: url,
  GITHUB_CLIENT_ID: str,
  GITHUB_CLIENT_SECRET: str,
  ADMIN_GITHUB_ID: optional(z.string().regex(/^\d+$/, "must be a numeric GitHub user id")),
  BLOB_READ_WRITE_TOKEN: str,
  CRON_SECRET: str,
  UPSTASH_REDIS_REST_URL: url,
  UPSTASH_REDIS_REST_TOKEN: str,
  LIKE_SECRET: str,
  STRAVA_CLIENT_ID: str,
  STRAVA_CLIENT_SECRET: str,
  STRAVA_REFRESH_TOKEN: str,
  STATSFM_USER: str,
  LETTERBOXD_USER: str,
  RESEND_API_KEY: str,
  RESEND_FROM: str,
  NEXT_PUBLIC_CALCOM_LINK: str,
  NEXT_PUBLIC_STRAVA_URL: url,
  NEXT_PUBLIC_SITE_URL: url,
});

export type Env = z.infer<typeof envSchema>;
export type EnvName = keyof Env;

/** Parses `source`; the error names the bad variables, never their values. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);

/** Reads a var at the point of use (live from process.env) and throws a clear error if it's unset. */
export function requireEnv(name: EnvName): string {
  const value = parseEnv({ [name]: process.env[name] })[name];
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${name}. Set it in .env.local (dev) or the Vercel project.`);
  }
  return value;
}
