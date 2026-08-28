import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// In-memory fallback sliding window limiter for local dev or when Upstash is unset
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
}

let ratelimitSubmit: Ratelimit | null = null;
let ratelimitTrack: Ratelimit | null = null;

function getUpstashLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!ratelimitSubmit) {
    const redis = new Redis({ url, token });
    // 5 requests per 1 minute for submission
    ratelimitSubmit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "soczen:rl:submit",
    });

    // 20 requests per 1 minute for tracking
    ratelimitTrack = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      analytics: true,
      prefix: "soczen:rl:track",
    });
  }

  return { submit: ratelimitSubmit, track: ratelimitTrack! };
}

export async function checkSubmissionRateLimit(identifier: string): Promise<{
  success: boolean;
  remaining?: number;
  message?: string;
}> {
  const upstash = getUpstashLimiters();

  if (upstash) {
    try {
      const res = await upstash.submit.limit(identifier);
      if (!res.success) {
        return {
          success: false,
          remaining: res.remaining,
          message: "Too many submission attempts. Please wait a moment before trying again.",
        };
      }
      return { success: true, remaining: res.remaining };
    } catch (err) {
      console.warn("Upstash rate limit error, using memory fallback:", err);
    }
  }

  // Memory fallback: 5 attempts per 60s
  const memRes = memoryRateLimit(`submit:${identifier}`, 5, 60_000);
  if (!memRes.success) {
    return {
      success: false,
      message: "Too many submission attempts. Please wait a minute before trying again.",
    };
  }

  return { success: true, remaining: memRes.remaining };
}

export async function checkTrackingRateLimit(identifier: string): Promise<{
  success: boolean;
  remaining?: number;
  message?: string;
}> {
  const upstash = getUpstashLimiters();

  if (upstash) {
    try {
      const res = await upstash.track.limit(identifier);
      if (!res.success) {
        return {
          success: false,
          remaining: res.remaining,
          message: "Too many tracking lookups. Please wait a moment before searching again.",
        };
      }
      return { success: true, remaining: res.remaining };
    } catch (err) {
      console.warn("Upstash tracking rate limit error, using memory fallback:", err);
    }
  }

  // Memory fallback: 20 lookups per 60s
  const memRes = memoryRateLimit(`track:${identifier}`, 20, 60_000);
  if (!memRes.success) {
    return {
      success: false,
      message: "Too many tracking lookups. Please wait a moment before searching again.",
    };
  }

  return { success: true, remaining: memRes.remaining };
}

