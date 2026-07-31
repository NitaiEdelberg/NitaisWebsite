// Tests for the anti-hallucination grounding layer — the promise that the AI
// recommender never shows a film that doesn't really exist.
//
// The LLM proposes candidate titles; every one is verified against a real source
// (here: Wikipedia, the keyless default) and dropped unless it genuinely matches.
// We stub global fetch so these run offline and deterministically.
//
// Run:  node --test test/movieLookup.test.js   (from backend/)
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normTitle,
  titlesMatch,
  verifyCandidates,
  groundingProvider,
} from "../utils/movieLookup.js";

// --- A fake Wikipedia backend -------------------------------------------------
// Maps a search string to the page the real API would return. A title with no
// entry here returns "no pages" (i.e. the film doesn't exist) — exactly what
// should happen for a hallucinated title.
const WIKI_DB = {
  inception: {
    title: "Inception",
    description: "2010 film by Christopher Nolan",
    extract: "Inception is a 2010 science fiction action film written and directed by Christopher Nolan.",
    thumbnail: { source: "https://upload.wikimedia.org/inception.jpg" },
  },
  "the matrix": {
    title: "The Matrix",
    description: "1999 film by the Wachowskis",
    extract: "The Matrix is a 1999 science fiction action film.",
  },
  // A page that exists but is NOT a film — must be rejected by the is-film guard.
  mercury: {
    title: "Mercury (planet)",
    description: "smallest planet in the Solar System",
    extract: "Mercury is the smallest planet in the Solar System.",
  },
  // A real page whose title does NOT match what we searched for — the search
  // engine's "closest" result to a made-up title. Must be rejected by the
  // title-overlap guard so we never pass off an unrelated film as the answer.
  "the quantum paradox chronicles": {
    title: "Primer",
    description: "2004 film by Shane Carruth",
    extract: "Primer is a 2004 American science fiction film.",
  },
};

function makeWikiResponse(searchStr) {
  // searchStr is like "Inception 2010 film" — strip the trailing " film" and any year.
  const key = searchStr
    .toLowerCase()
    .replace(/\bfilm\b/g, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const page = WIKI_DB[key];
  if (!page) return { batchcomplete: "", query: undefined }; // no such film
  return { query: { pages: { "1": page } } };
}

function installFetchStub() {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    const u = new URL(url);
    const search = u.searchParams.get("gsrsearch") || "";
    const body = makeWikiResponse(search);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
    };
  };
  return {
    restore: () => { globalThis.fetch = original; },
    get calls() { return calls; },
  };
}

// --- normTitle ----------------------------------------------------------------
test("normTitle strips a '(2010 film)' qualifier and punctuation", () => {
  assert.equal(normTitle("Inception (2010 film)"), "inception");
  assert.equal(normTitle("Amélie!"), "am lie"); // accented/punctuation chars → space
  assert.equal(normTitle("The Matrix: Reloaded"), "the matrix reloaded");
});

// --- titlesMatch (the guard) --------------------------------------------------
test("titlesMatch accepts exact, substring and qualifier variants", () => {
  assert.equal(titlesMatch("Inception", "Inception"), true);
  assert.equal(titlesMatch("Inception", "Inception (2010 film)"), true);
  assert.equal(titlesMatch("the matrix", "The Matrix"), true);
});

test("titlesMatch rejects an unrelated film returned for an invented title", () => {
  // A hallucinated title should not be 'confirmed' by a completely different film.
  assert.equal(titlesMatch("The Quantum Paradox Chronicles", "Primer"), false);
  assert.equal(titlesMatch("Galaxy of the Forgotten Sun", "Star Wars"), false);
});

test("titlesMatch needs most requested words present (0.6 overlap)", () => {
  // 2 of 3 meaningful words = 0.66 ≥ 0.6 → match.
  assert.equal(titlesMatch("The Dark Knight", "Dark Knight"), true);
  // Two multi-word titles sharing only one word: 1/4 = 0.25 < 0.6 → no match.
  // (Neither is a substring of the other, so the token-overlap rule decides.)
  assert.equal(titlesMatch("Eternal Sunshine Spotless Mind", "Sunshine Cleaning"), false);
});

test("titlesMatch handles Hebrew titles", () => {
  assert.equal(titlesMatch("הסרט", "הסרט"), true);
});

// --- verifyCandidates (end-to-end grounding) ----------------------------------
test("a real candidate is verified and canonicalized", async () => {
  const stub = installFetchStub();
  try {
    const out = await verifyCandidates([{ title: "Inception", year: 2010 }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].title, "Inception");
    assert.equal(out[0].year, 2010);
    assert.equal(out[0].source, "wikipedia");
    assert.match(out[0].url, /wikipedia\.org\/wiki\/Inception/);
  } finally {
    stub.restore();
  }
});

test("a hallucinated title (no such film) is dropped", async () => {
  const stub = installFetchStub();
  try {
    const out = await verifyCandidates([{ title: "The Nonexistent Dragon War", year: 2021 }]);
    assert.equal(out.length, 0);
  } finally {
    stub.restore();
  }
});

test("a real page that isn't a film is dropped", async () => {
  const stub = installFetchStub();
  try {
    const out = await verifyCandidates([{ title: "Mercury", year: null }]);
    assert.equal(out.length, 0, "a planet is not a movie");
  } finally {
    stub.restore();
  }
});

test("an invented title matched to an unrelated film is dropped", async () => {
  const stub = installFetchStub();
  try {
    // Wikipedia returns 'Primer' for this made-up title; the overlap guard rejects it.
    const out = await verifyCandidates([{ title: "The Quantum Paradox Chronicles", year: 2019 }]);
    assert.equal(out.length, 0);
  } finally {
    stub.restore();
  }
});

test("mixed batch: keeps the real ones, drops fakes, de-dupes", async () => {
  const stub = installFetchStub();
  try {
    const out = await verifyCandidates([
      { title: "Inception", year: 2010 },
      { title: "The Nonexistent Dragon War", year: 2021 }, // fake → dropped
      { title: "Inception (2010 film)", year: 2010 },       // dup of #1 → collapsed
      { title: "The Matrix", year: 1999 },
    ]);
    const titles = out.map((m) => m.title).sort();
    assert.deepEqual(titles, ["Inception", "The Matrix"]);
  } finally {
    stub.restore();
  }
});

test("groundingProvider reports wikipedia when no TMDB key is set", () => {
  // The test env has no TMDB_API_KEY, so the keyless provider is in play — this is
  // exactly the case the UI badge must label correctly.
  assert.equal(groundingProvider(), process.env.TMDB_API_KEY ? "tmdb" : "wikipedia");
});
