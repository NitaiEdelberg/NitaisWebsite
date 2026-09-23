// The recommendation pipeline, stage by stage, with no model and no database.
//
// Everything external is injected, so these run in milliseconds and fail for
// exactly one reason: the pipeline did the wrong thing. The failure modes here
// are the ones that actually happen — a model that invents films, returns
// nonsense, repeats itself, or ignores the exclusion list.
import test from "node:test";
import assert from "node:assert/strict";

import { recommend } from "../services/recommendation/index.js";
import { parseRecommendation } from "../services/recommendation/validate.js";
import { rankAndDiversify, scoreMovie } from "../services/recommendation/rank.js";
import { LIMITS, buildContext, estimateTokens } from "../services/recommendation/context.js";
import {
  activePreferences, mergePreferences, sanitise,
} from "../services/recommendation/memory.js";

const reply = (movies, text = "Here are a few.") => async () => ({
  choices: [{ message: { content: JSON.stringify({ reply: text, movies }) } }],
  trace: { models: ["test-model"], calls: [{ tokens: 100 }] },
});

// Verification stands in for the film database: anything titled "Fake ..." does
// not exist, everything else does.
const verifyAllButFakes = async (candidates) =>
  candidates
    .filter((c) => !c.title.startsWith("Fake"))
    .map((c) => ({
      title: c.title, year: c.year, poster: "", overview: "A real film.",
      rating: 7.5, source: "test",
    }));

const session = (over = {}) => ({
  messages: [], summary: "", preferences: [], shown: [], rejected: [], ...over,
});

// ---- the whole pipeline -------------------------------------------------

test("a normal request returns verified films and a reply", async () => {
  const result = await recommend({
    message: "something like Heat",
    session: session(),
    chat: reply([
      { title: "Ronin", year: 1998, why: "Same cold professionalism." },
      { title: "The Town", year: 2010, why: "Heist, working-class weight." },
    ]),
    verify: verifyAllButFakes,
  });

  assert.equal(result.movies.length, 2);
  assert.equal(result.reply, "Here are a few.");
  assert.equal(result.trace.verification.unverifiable, 0);
  assert.ok(result.movies[0].why, "the model's reason survives verification");
});

test("a film the model invented never reaches the user", async () => {
  const result = await recommend({
    message: "gritty crime",
    session: session(),
    chat: reply([
      { title: "Ronin", year: 1998, why: "Real." },
      { title: "Fake Heist 2", year: 2011, why: "Invented." },
      { title: "Fake Noir", year: 1994, why: "Also invented." },
    ]),
    verify: verifyAllButFakes,
  });

  assert.deepEqual(result.movies.map((m) => m.title), ["Ronin"]);
  assert.equal(result.trace.verification.unverifiable, 2,
    "and the count of what was dropped is reported, not hidden");
});

test("films already seen or owned are filtered out", async () => {
  const result = await recommend({
    message: "more like that",
    session: session({ shown: ["Ronin"], rejected: ["The Town"] }),
    library: { owned: ["Collateral"], liked: [] },
    chat: reply([
      { title: "Ronin", year: 1998, why: "Shown before." },
      { title: "The Town", year: 2010, why: "Rejected before." },
      { title: "Collateral", year: 2004, why: "Already owned." },
      { title: "Thief", year: 1981, why: "New." },
    ]),
    verify: verifyAllButFakes,
  });

  assert.deepEqual(result.movies.map((m) => m.title), ["Thief"]);
  assert.equal(result.trace.filtering.blocked_as_seen, 3);
});

test("an empty message is refused before any model call", async () => {
  let called = false;
  await assert.rejects(
    () => recommend({
      message: "   ",
      session: session(),
      chat: async () => { called = true; return {}; },
      verify: verifyAllButFakes,
    }),
    (err) => err.status === 400
  );
  assert.equal(called, false, "no tokens spent on an empty request");
});

test("a model failure surfaces as an upstream error, not a crash", async () => {
  await assert.rejects(
    () => recommend({
      message: "anything",
      session: session(),
      chat: async () => { const e = new Error("Groq API 503"); e.status = 503; throw e; },
      verify: verifyAllButFakes,
    }),
    (err) => err.status === 503
  );
});

test("unparseable model output is a 502 with a reason", async () => {
  await assert.rejects(
    () => recommend({
      message: "anything",
      session: session(),
      chat: async () => ({ choices: [{ message: { content: "I'm afraid I can't do that." } }] }),
      verify: verifyAllButFakes,
    }),
    (err) => err.status === 502 && Array.isArray(err.details)
  );
});

test("a verification outage empties the list rather than inventing one", async () => {
  const result = await recommend({
    message: "anything",
    session: session(),
    chat: reply([{ title: "Ronin", year: 1998, why: "Real." }]),
    verify: async () => [], // the film database is down
  });
  assert.deepEqual(result.movies, []);
  assert.match(result.reply, /couldn't find|Nothing new/i);
});

test("the context sent to the model stays bounded as a conversation grows", async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user", text: `turn ${i}`, titles: [],
  }));
  const context = buildContext({
    message: "now what",
    session: session({ messages: many, shown: Array.from({ length: 200 }, (_, i) => `Film ${i}`) }),
    library: {},
  });

  assert.equal(context.turns.length, 6, "only the recent turns go in verbatim");
  assert.ok(context.avoid.length <= 40, "the exclusion list is capped");
  assert.ok(estimateTokens(context) < 2000, "so the prompt cannot grow without limit");
});

// ---- validation ----------------------------------------------------------

test("validation drops junk rows but keeps the good ones", () => {
  const parsed = parseRecommendation(JSON.stringify({
    reply: "Here.",
    movies: [
      { title: "Heat", year: 1995, why: "Yes" },
      { title: "Heat", year: 1995, why: "Duplicate" },
      { title: "", year: 2000, why: "No title" },
      { title: "Odd Year", year: 3999, why: "Implausible" },
      "not an object",
    ],
  }));

  assert.deepEqual(parsed.movies.map((m) => m.title), ["Heat", "Odd Year"]);
  assert.equal(parsed.movies[1].year, null, "an implausible year is dropped, not passed on as fact");
  assert.ok(parsed.problems.length >= 3);
});

test("validation refuses output that is not JSON at all", () => {
  const parsed = parseRecommendation("sorry, here are some films: Heat, Ronin");
  assert.equal(parsed.ok, false);
});

// ---- ranking -------------------------------------------------------------

test("ranking spreads the decades, then fills rather than returning a short list", () => {
  // Eight films, six of them from 1995. Diversity takes two of the six and
  // both outliers; the fifth slot is backfilled, because five good suggestions
  // beat four perfectly spread ones. Both halves of that trade are asserted.
  const nineties = Array.from({ length: 6 }, (_, i) => ({
    title: `Nineties ${i}`, year: 1995, overview: "x".repeat(60), why: "fits", poster: "p",
  }));
  const others = [
    { title: "Seventies", year: 1974, overview: "x".repeat(60), why: "fits", poster: "p" },
    { title: "Twenties", year: 2021, overview: "x".repeat(60), why: "fits", poster: "p" },
  ];

  const ranked = rankAndDiversify([...nineties, ...others], { limit: 5 });
  const titles = ranked.map((m) => m.title);

  assert.equal(ranked.length, 5, "the list is full");
  assert.ok(titles.includes("Seventies") && titles.includes("Twenties"),
    "both outliers were pulled in ahead of a sixth nineties film");
  assert.ok(ranked.filter((m) => m.year === 1995).length < 5,
    "and the list did not collapse into one decade");
});

test("with enough spread available, no decade takes more than its share", () => {
  const spread = [1974, 1985, 1995, 2004, 2013, 1996, 1997].map((year, i) => ({
    title: `Film ${i}`, year, overview: "x".repeat(60), why: "fits", poster: "p",
  }));
  const ranked = rankAndDiversify(spread, { limit: 5 });
  const nineties = ranked.filter((m) => m.year >= 1990 && m.year < 2000);
  assert.ok(nineties.length <= 2, "the cap holds when it does not cost a slot");
});

test("an explained, enriched film outranks a bare title", () => {
  const rich = { title: "A", year: 2000, why: "Because it is quiet and sad", overview: "x".repeat(60), poster: "p", rating: 8 };
  const bare = { title: "B", year: 2000, why: "", overview: "", poster: "" };
  assert.ok(scoreMovie(rich, 0) > scoreMovie(bare, 0));
});

// ---- memory --------------------------------------------------------------

test("an explicit preference outranks an inference about the same thing", () => {
  let prefs = mergePreferences([], [{ kind: "genre", value: "horror", sentiment: "likes" }], "inferred");
  prefs = mergePreferences(prefs, [{ kind: "genre", value: "horror", sentiment: "dislikes" }], "explicit");
  const horror = prefs.find((p) => p.value === "horror");
  assert.equal(horror.sentiment, "dislikes");
  assert.equal(horror.source, "explicit");
});

test("an inference cannot overwrite something the person said", () => {
  let prefs = mergePreferences([], [{ kind: "genre", value: "horror", sentiment: "dislikes" }], "explicit");
  prefs = mergePreferences(prefs, [{ kind: "genre", value: "horror", sentiment: "likes" }], "inferred");
  assert.equal(prefs.find((p) => p.value === "horror").sentiment, "dislikes");
});

test("a weak inference does not influence a recommendation until it recurs", () => {
  let prefs = mergePreferences([], [{ kind: "era", value: "1990s", sentiment: "likes" }], "inferred");
  assert.equal(activePreferences(prefs).length, 0, "seen once: a guess");
  prefs = mergePreferences(prefs, [{ kind: "era", value: "1990s", sentiment: "likes" }], "inferred");
  prefs = mergePreferences(prefs, [{ kind: "era", value: "1990s", sentiment: "likes" }], "inferred");
  assert.equal(activePreferences(prefs).length, 1, "seen three times: a pattern");
});

test("preferences outside the vocabulary are discarded", () => {
  const clean = sanitise([
    { kind: "genre", value: "Noir", sentiment: "likes" },
    { kind: "astrology", value: "libra", sentiment: "likes" },
    { kind: "genre", value: "x", sentiment: "maybe" },
    "nonsense",
  ]);
  assert.deepEqual(clean, [{ kind: "genre", value: "noir", sentiment: "likes" }]);
});

// A watchlist app's best user has a big watchlist, and that is precisely who
// this broke for. The avoid list was one concatenation truncated to forty, with
// `shown` last — so past about forty owned films, nothing recently suggested
// survived into it. That list is not only advice to the model; it is the hard
// filter applied to what comes back. The recommender repeated itself, and the
// filter built to stop that had been truncated away.
test("a big library does not push recent suggestions out of the avoid list", () => {
  const owned = Array.from({ length: 60 }, (_, i) => `Owned Film ${i + 1}`);
  const session = {
    preferences: [], messages: [], rejected: ["Turned Down"],
    shown: ["Suggested Just Now", "Suggested A Moment Ago"],
  };

  const context = buildContext({ message: "something else", session, library: { owned, liked: [] } });

  assert.ok(context.avoid.includes("Suggested Just Now"));
  assert.ok(context.avoid.includes("Suggested A Moment Ago"));
  assert.ok(context.avoid.includes("Turned Down"));
  assert.ok(context.avoid.length <= LIMITS.avoidTitles);
  // The library still gets most of the room; it just no longer gets all of it.
  assert.ok(context.avoid.filter((t) => t.startsWith("Owned")).length >= 14);
});
