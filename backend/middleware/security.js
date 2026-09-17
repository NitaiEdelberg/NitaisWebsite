// Headers and limits, set by hand rather than by pulling in helmet.
//
// Four headers and a body cap is not worth a dependency and its transitive
// tree; what it IS worth is knowing why each one is here, which a middleware
// package tends to hide.

/** Response headers that cost nothing and close obvious doors. */
export function securityHeaders(req, res, next) {
  // This API answers JSON. A browser that decides a response is HTML because
  // it starts with a "<" is how a stored string becomes a script.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Nothing here is meant to be framed; clickjacking needs a frame.
  res.setHeader("X-Frame-Options", "DENY");
  // Do not leak the page somebody came from to third parties.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // No feature here needs a camera, a microphone or a location.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

/**
 * Who may call this API from a browser.
 *
 * Same-origin in production, because the frontend is served from the same
 * place. The allowlist exists for the Netlify deployment, where the site and
 * the function share an origin, and for local development where they do not.
 * A wildcard would make every other site on the internet a valid caller.
 */
export function cors(req, res, next) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
