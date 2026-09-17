// Rate limiting, in memory, without a dependency.
//
// The AI route spends real money per call and sits behind one shared API key,
// so an unbounded route is an unbounded bill — and the guard that route already
// has (a login) costs nothing to obtain. Per-user limits are what actually
// protect the key; the IP limit is the backstop for routes reached before any
// user is known.
//
// In-process on purpose: one instance serves this app, and a limiter that
// forgets on restart is a limiter that fails open for one minute rather than a
// reason to run Redis. If this ever runs on several instances, this becomes
// per-instance and the numbers below need dividing — written down here so that
// is a known limitation rather than a surprise.

const buckets = new Map();

function hit(key, { windowMs, max, clock }) {
  const now = clock();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: max - 1, resetMs: windowMs };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetMs: windowMs - (now - bucket.start),
  };
}

/** Sweep stale buckets so a long-running process does not grow a map forever. */
function sweep(windowMs, clock) {
  const now = clock();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start >= windowMs * 2) buckets.delete(key);
  }
}

export function rateLimit({
  windowMs = 60_000,
  max = 60,
  name = "general",
  by = (req) => req.userId || req.ip,
  clock = Date.now,
} = {}) {
  return (req, res, next) => {
    if (Math.random() < 0.01) sweep(windowMs, clock);

    const key = `${name}:${by(req)}`;
    const { allowed, remaining, resetMs } = hit(key, { windowMs, max, clock });

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (allowed) return next();

    const seconds = Math.ceil(resetMs / 1000);
    res.setHeader("Retry-After", String(seconds));
    return res.status(429).json({
      success: false,
      message: `Slow down a moment — try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    });
  };
}

// Recommendations: generous enough that nobody exploring hits it, tight enough
// that a script cannot spend the month's tokens in an afternoon.
export const aiRateLimit = rateLimit({ name: "ai", windowMs: 60_000, max: 12 });

// Auth: the limit that matters for password guessing, keyed by IP because the
// whole point is that the user is not known yet.
export const authRateLimit = rateLimit({
  name: "auth", windowMs: 15 * 60_000, max: 20, by: (req) => req.ip,
});

export const _resetRateLimits = () => buckets.clear();
