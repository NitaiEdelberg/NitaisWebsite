import test from "node:test";
import assert from "node:assert/strict";

import { normalisePath } from "../../netlify/functions/api.js";

// serverless-http hands event.path straight to Express, and Netlify's rewrite
// may deliver the client path, the rewritten function path, or the function
// path with the mount point doubled. Which one is platform behaviour not worth
// betting a deploy on, so all three are normalised to what Express mounts.
test("every path shape Netlify might send reaches the same route", () => {
  for (const path of [
    "/api/movies",
    "/.netlify/functions/api/movies",
    "/.netlify/functions/api/api/movies",
  ]) {
    assert.equal(normalisePath(path), "/api/movies");
  }
});

test("nested paths keep their tail", () => {
  assert.equal(normalisePath("/.netlify/functions/api/movies/abc123"), "/api/movies/abc123");
  assert.equal(normalisePath("/api/auth/login"), "/api/auth/login");
});

test("the bare function path still lands inside the API", () => {
  assert.equal(normalisePath("/.netlify/functions/api"), "/api");
  assert.equal(normalisePath(undefined), "/api");
});

test("a path that already looks like the API is left alone", () => {
  assert.equal(normalisePath("/api/health"), "/api/health");
});
