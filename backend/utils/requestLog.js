// One JSON line per interesting thing, always carrying a request id.
//
// The AI path has six stages and any of them can be the reason an answer was
// slow or wrong. Prose logs make that unanswerable after the fact; a line per
// request with the stage numbers in it makes "why did this take nine seconds"
// a search rather than an investigation.
//
// What is deliberately absent: the message text, the reply text, and anything
// about who the person is. The id ties the lines together, the counts say what
// happened, and the content of somebody's private conversation about films
// stays out of the log.

import { randomUUID } from "crypto";

export const newRequestId = () => randomUUID().slice(0, 8);

export function logEvent(event, fields = {}) {
  const line = { event, at: new Date().toISOString(), ...fields };
  console.log(JSON.stringify(line));
}

/** Express middleware: give every request an id and log how it ended. */
export function requestContext(req, res, next) {
  req.id = newRequestId();
  res.setHeader("X-Request-Id", req.id);
  const started = Date.now();

  res.on("finish", () => {
    // Only the AI path and failures are worth a line; a 200 on /api/movies
    // every few seconds is noise that buries the entries that matter.
    const interesting = res.statusCode >= 400 || req.path.startsWith("/api/ai");
    if (!interesting) return;
    logEvent("request", {
      request_id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });

  next();
}
