import "server-only";

import { NextResponse } from "next/server";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { normalizeUsername } from "./username";

/**
 * Distributed rate limiting for serverless route handlers.
 *
 * Redis holds only ephemeral `ratelimit:{policy}:{identifier}` counters with
 * TTLs. Firebase remains the system of record; nothing here is read back as
 * application state. The Redis client is constructed lazily so `next build`
 * stays green on machines without `UPSTASH_REDIS_REST_URL/TOKEN`, and an
 * injected client is used verbatim so tests never touch real Redis.
 *
 * Each route calls {@link checkRateLimit} explicitly with its own policy -
 * there is intentionally no middleware and no global bucket, because login,
 * registration, payments and polling have different abuse models.
 *
 * When the store is unreachable the per-policy `failClosed` flag decides:
 * account-access endpoints (login, PIN) answer 503 rather than open a
 * brute-force window, while everything else fails open with an error log.
 * Denials and outages are logged; allowed requests are not, because polling
 * endpoints would flood the log. Logged lines never carry passwords, tokens,
 * keys, reset links, or raw email addresses.
 */

export type IdentifierClass = "ip" | "uid" | "email" | "account";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; unavailable?: boolean };

export type RateLimitOptions = {
  /** Policy name, e.g. "login-ip". Becomes part of the Redis key. */
  name: string;
  /** Already-normalized key material (IP, UID, email, handle). Never a secret. */
  identifier: string;
  /** What kind of value `identifier` is, for logging only. */
  identifierClass: IdentifierClass;
  limit: number;
  window: Duration;
  mode?: "sliding" | "fixed";
  /** True: 503 when Redis is down. False: allow with an error log. */
  failClosed: boolean;
  /**
   * False peeks via getRemaining without consuming a token. Used by the login
   * account bucket, which must only increment on failed logins.
   */
  consume?: boolean;
  /** Injected Redis client for tests. Defaults to the lazy shared client. */
  redis?: Redis;
};

const PREFIX = "ratelimit";
const UNAVAILABLE_RETRY_AFTER = 60;

let shared: Redis | null = null;
let missingConfigWarned = false;
const limiters = new Map<string, Ratelimit>();

function sharedRedis(): Redis {
  if (!shared) {
    // Detected explicitly rather than relying on the client's internals:
    // `Redis.fromEnv()` builds a broken client instead of throwing, which
    // would only fail later inside `limit()`. Failing here keeps the
    // fail-open/fail-closed decision deterministic. Names only, never values.
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not configured");
    }
    shared = Redis.fromEnv();
  }
  return shared;
}

function buildLimiter(
  redis: Redis,
  limit: number,
  window: Duration,
  mode: "sliding" | "fixed",
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter:
      mode === "fixed" ? Ratelimit.fixedWindow(limit, window) : Ratelimit.slidingWindow(limit, window),
    prefix: PREFIX,
    analytics: false,
  });
}

function retryAfterFrom(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

function storeDown(options: RateLimitOptions, error: unknown): RateLimitResult {
  const detail = error instanceof Error ? error.message : "unknown error";
  if (options.failClosed) {
    console.error(`[ratelimit] ${options.name} store unavailable, failing closed: ${detail}`);
    return { ok: false, retryAfter: UNAVAILABLE_RETRY_AFTER, unavailable: true };
  }
  console.error(`[ratelimit] ${options.name} store unavailable, failing open: ${detail}`);
  return { ok: true };
}

export async function checkRateLimit(
  // Accepted for a stable call shape; the key material comes from `options`.
  _req: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${options.name}:${options.identifier}`;
  const mode = options.mode ?? "sliding";
  const consume = options.consume ?? true;

  let redis = options.redis;
  if (!redis) {
    try {
      redis = sharedRedis();
    } catch (error) {
      if (!missingConfigWarned) {
        missingConfigWarned = true;
        console.error("[ratelimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not configured");
      }
      return storeDown(options, error);
    }
  }

  try {
    // Injected clients bypass the cache so tests never share limiter state.
    let limiter: Ratelimit;
    if (options.redis) {
      limiter = buildLimiter(redis, options.limit, options.window, mode);
    } else {
      const cacheKey = `${options.name}:${options.limit}:${options.window}:${mode}`;
      const cached = limiters.get(cacheKey);
      if (cached) {
        limiter = cached;
      } else {
        limiter = buildLimiter(redis, options.limit, options.window, mode);
        limiters.set(cacheKey, limiter);
      }
    }

    if (!consume) {
      const peek = await limiter.getRemaining(key);
      if (peek.remaining <= 0) {
        console.warn(`[ratelimit] ${options.name} denied (class=${options.identifierClass}, peek)`);
        return { ok: false, retryAfter: retryAfterFrom(peek.reset) };
      }
      return { ok: true };
    }

    const result = await limiter.limit(key);
    if (result.reason === "timeout") {
      // The store did not answer in time: inconclusive, not allowed.
      return storeDown(options, new Error("Upstash request timed out"));
    }
    if (!result.success) {
      const retryAfter = retryAfterFrom(result.reset);
      console.warn(
        `[ratelimit] ${options.name} denied (class=${options.identifierClass}, retryAfter=${retryAfter}s)`,
      );
      return { ok: false, retryAfter };
    }
    return { ok: true };
  } catch (error) {
    return storeDown(options, error);
  }
}

/**
 * Best-effort client IP behind the Vercel edge.
 *
 * Assumes Fignal is directly behind Vercel: the edge overwrites `x-real-ip`
 * with the observed peer, so it cannot be spoofed through Vercel, while a
 * client-supplied `x-forwarded-for` gets the real peer *appended* - which is
 * why the FIRST entry must never be trusted and only the LAST is used here.
 * Revisit this if a third-party proxy is ever placed in front.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  const cleanedReal = real ? cleanIp(real) : null;
  if (cleanedReal) return cleanedReal;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const last = parts.length > 0 ? parts[parts.length - 1] : undefined;
    const cleanedLast = last ? cleanIp(last) : null;
    if (cleanedLast) return cleanedLast;
  }

  return "local";
}

function cleanIp(value: string): string | null {
  const bare = value.replace(/^\[|\]$/g, "").split("%")[0]?.trim() ?? "";
  if (!isIp(bare)) return null;
  return bare.slice(0, 64).toLowerCase();
}

function isIp(value: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return true;
  return value.includes(":") && /^[0-9a-fA-F:.]{2,}$/.test(value);
}

/** Lowercased, length-capped email for the forgot-password bucket. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

/** Same normalization the login path uses, capped for key safety. */
export function normalizeHandle(value: string): string {
  return normalizeUsername(value).slice(0, 64);
}

export function rateLimited(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Wait a bit and try again.", retryAfter },
    {
      status: 429,
      headers: { "cache-control": "no-store", "retry-after": String(retryAfter) },
    },
  );
}

export function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Service temporarily unavailable." },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": String(UNAVAILABLE_RETRY_AFTER) },
    },
  );
}
