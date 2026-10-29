import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Counter storage for views and likes (spec §9.2–9.3). Edge-safe: Upstash talks
// REST over fetch, and the memory store is plain JS.

export type CounterStore = {
  incr(key: string): Promise<number>;
  get(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  scard(key: string): Promise<number>;
  sismember(key: string, member: string): Promise<boolean>;
};

export function redisStore(redis: Redis = Redis.fromEnv()): CounterStore {
  return {
    incr: (key) => redis.incr(key),
    get: async (key) => Number((await redis.get<number | string>(key)) ?? 0),
    sadd: (key, member) => redis.sadd(key, member),
    scard: (key) => redis.scard(key),
    sismember: async (key, member) => (await redis.sismember(key, member)) === 1,
  };
}

/** In-process store for tests and for local dev without Upstash env. */
export function memoryStore(): CounterStore {
  const nums = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  const set = (key: string) => {
    let s = sets.get(key);
    if (!s) sets.set(key, (s = new Set()));
    return s;
  };
  return {
    incr: async (key) => {
      const n = (nums.get(key) ?? 0) + 1;
      nums.set(key, n);
      return n;
    },
    get: async (key) => nums.get(key) ?? 0,
    sadd: async (key, member) => {
      const s = set(key);
      if (s.has(member)) return 0;
      s.add(member);
      return 1;
    },
    scard: async (key) => sets.get(key)?.size ?? 0,
    sismember: async (key, member) => sets.get(key)?.has(member) ?? false,
  };
}

const hasUpstash = () => Boolean(process.env.UPSTASH_REDIS_REST_URL);

let shared: CounterStore | null = null;
let sharedMemory: CounterStore | null = null;

/** The store the API routes use: Upstash when configured, else memory. */
export function getStore(): CounterStore {
  if (hasUpstash()) return (shared ??= redisStore());
  return (sharedMemory ??= memoryStore());
}

/** Test helper: forget everything the shared memory store holds. */
export function resetMemoryStore(): void {
  sharedMemory = null;
}

let limiter: Ratelimit | null = null;

/**
 * 30 requests per 10 s sliding window per identifier (a hashed IP).
 * Always allows when Upstash isn't configured (tests, local dev).
 */
export async function allowRequest(identifier: string): Promise<boolean> {
  if (!hasUpstash()) return true;
  limiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, "10 s"),
    prefix: "rl:counters",
  });
  const { success } = await limiter.limit(identifier);
  return success;
}
