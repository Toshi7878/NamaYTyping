import type { Request } from "firebase-functions/v2/https";

const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 10;
const maxRateLimitEntries = 5000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export const getClientIp = (req: Request) => {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return req.ip ?? "unknown";
};

const pruneRateLimitBuckets = (now: number) => {
  if (rateLimitBuckets.size <= maxRateLimitEntries) return;

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
};

export function assertRateLimit(key: string) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + rateLimitWindowMs,
    });
    pruneRateLimitBuckets(now);
    return;
  }

  bucket.count += 1;
  if (bucket.count > maxRequestsPerWindow) {
    throw new RateLimitError(
      "Too Many Requests",
      Math.ceil((bucket.resetAt - now) / 1000),
    );
  }
}
