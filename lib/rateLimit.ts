/**
 * lib/rateLimit.ts — Sliding-window in-memory rate limiter
 *
 * Suitable for a single-instance Node.js/Vercel serverless environment.
 * Not distributed — each cold-start gets a fresh store, which is acceptable
 * for abuse prevention (slows bots, doesn't need to be perfect).
 *
 * Usage:
 *   const ok = checkRateLimit(`send-reset:${ip}`, 3, 60_000);
 *   if (!ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 *
 * Design note — maybePrune fix:
 *   Previously maybePrune received the per-call windowMs and used it to evict
 *   timestamps from ALL buckets. A bucket with a long window (e.g. 1 hour) could
 *   be incorrectly pruned if a short-window route (e.g. 60 s) triggered the prune.
 *   Fix: each bucket now stores its own windowMs so prune uses the correct window
 *   per bucket rather than whatever happened to call maybePrune last.
 */

interface Bucket {
  timestamps: number[];
  windowMs: number; // stored per bucket to ensure correct per-bucket pruning
}

const store = new Map<string, Bucket>();

let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60_000;

function maybePrune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of Array.from(store.entries())) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < bucket.windowMs);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}

/**
 * Returns true if the request is within the allowed rate.
 * Returns false if the limit has been exceeded.
 *
 * @param key        Unique key (e.g. `"reset:${ip}"`)
 * @param maxCount   Maximum number of requests allowed in the window
 * @param windowMs   Sliding window duration in milliseconds (default 60 000 = 1 min)
 */
export function checkRateLimit(
  key: string,
  maxCount: number,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  maybePrune(now);

  const bucket = store.get(key) ?? { timestamps: [], windowMs };
  // Always sync windowMs in case the same key is reused with a different window
  bucket.windowMs = windowMs;
  // Remove timestamps outside the current window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= maxCount) {
    store.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);
  return true;
}

/**
 * Extract the best available IP from a Next.js Request.
 * Falls back to 'unknown' if no IP can be determined.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
