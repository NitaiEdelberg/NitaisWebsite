// The bug: "a new comedy film from 2026, similar to The Dictator" returned
// films from 1999, 2004 and 2010.
import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_KNOWLEDGE_YEAR, enforce, explainShortfall, extractConstraints, satisfies,
} from "../services/recommendation/constraints.js";
import { recommend } from "../services/recommendation/index.js";

const THIS_YEAR = new Date().getFullYear();

// ---- reading the requirement out of the request --------------------------

test("a stated year is read as a requirement", () => {
  const c = extractConstraints("a new comedy film from 2026, similar to The Dictator");
  assert.equal(c.year.min, 2026);
  assert.equal(c.year.max, 2026);
  assert.equal(c.describe, "from 2026");
});

test("an explicit year wins over the vaguer words around it", () => {
  // "new" also matches, and would have given a different window.
  const c = extractConstraints("a new comedy from 1994");
  assert.equal(c.year.min, 1994);
  assert.equal(c.year.max, 1994);
});

test("decades, ranges and relative phrases all resolve to a window", () => {
  const window = (text) => {
    const y = extractConstraints(text).year;
    return [y.min, y.max];
  };
  // Written both ways round, because people write both.
  assert.deepEqual(window("something from the 90s"), [1990, 1999]);
  assert.deepEqual(window("a comedy from the 1980s"), [1980, 1989]);
  assert.deepEqual(window("something from the nineties"), [1990, 1999]);
  // A range has to be read before the bare year inside it.
  assert.deepEqual(window("anything before 2000"), [null, 1999]);
  assert.deepEqual(window("something since 2015"), [2016, null]);
  assert.deepEqual(window("between 1970 and 1979"), [1970, 1979]);
  assert.deepEqual(window("a thriller from the last 3 years"), [THIS_YEAR - 3, null]);
  assert.deepEqual(window("something new"), [THIS_YEAR - 1, null]);
  assert.deepEqual(window("a classic noir"), [null, 1990]);
});

test("a request with no year mentioned is not silently narrowed", () => {
  const c = extractConstraints("something like Heat");
  assert.equal(c.year, null);
  assert.equal(c.needsCatalogue, false);
});

test("a year past the model's knowledge is flagged as needing a catalogue", () => {
  assert.equal(extractConstraints(`a comedy from ${MODEL_KNOWLEDGE_YEAR + 1}`).needsCatalogue, true);
  assert.equal(extractConstraints(`a comedy from ${MODEL_KNOWLEDGE_YEAR - 5}`).needsCatalogue, false);
});

// ---- enforcing it --------------------------------------------------------

test("a film outside the window is dropped, not ranked", () => {
  const constraints = extractConstraints("a comedy from 2026");
  const { kept, dropped } = enforce(
    [
      { title: "Dogma", year: 1999 },
      { title: "Team America", year: 2004 },
      { title: "Something New", year: 2026 },
    ],
    constraints
  );
  assert.deepEqual(kept.map((m) => m.title), ["Something New"]);
  assert.equal(dropped.length, 2);
});

test("a film with no known year cannot satisfy a year requirement", () => {
  assert.equal(satisfies({ title: "?", year: null }, extractConstraints("from 2026")), false);
});

test("with no requirement, nothing is dropped", () => {
  const { kept } = enforce([{ title: "A", year: 1999 }], extractConstraints("something funny"));
  assert.equal(kept.length, 1);
});

// ---- saying so -----------------------------------------------------------

test("a request beyond the model's knowledge with no catalogue is answered honestly", () => {
  const message = explainShortfall(extractConstraints("a comedy from 2026"), {
    catalogueAvailable: false,
    foundAny: false,
  });
  assert.match(message, /stops around 2025/);
  assert.match(message, /guess dressed up as a fact/);
});

// ---- the whole pipeline, on the reported request --------------------------

test("the reported bug: 1999, 2004 and 2010 never reach a 2026 request", async () => {
  const result = await recommend({
    message: "a new comedy film from 2026, that is similar to The Dictator",
    session: { messages: [], preferences: [], shown: [], rejected: [] },
    // The model answers exactly as it did in production.
    chat: async () => ({
      choices: [{ message: { content: JSON.stringify({
        reply: "Here are some recent and classic picks that hit that satirical tone.",
        movies: [
          { title: "Dogma", year: 1999, why: "Sharp religious satire." },
          { title: "Team America: World Police", year: 2004, why: "Puppet political parody." },
          { title: "Four Lions", year: 2010, why: "Darkly comic look at extremism." },
        ],
      }) } }],
      trace: { models: ["test"], calls: [] },
    }),
    verify: async (candidates) => candidates.map((c) => ({ ...c, overview: "Real.", source: "test" })),
  });

  assert.deepEqual(result.movies, [], "nothing from the wrong decade is shown");
  assert.equal(result.trace.constraint_enforcement.dropped_outside_constraint, 3);
  assert.match(result.reply, /stops around/, "and the reply explains why rather than pretending");
});

test("a year the model does know is answered normally and filtered to it", async () => {
  const result = await recommend({
    message: "a comedy from 1994",
    session: { messages: [], preferences: [], shown: [], rejected: [] },
    chat: async () => ({
      choices: [{ message: { content: JSON.stringify({
        reply: "Two from that year.",
        movies: [
          { title: "Dumb and Dumber", year: 1994, why: "Peak nineties silliness." },
          { title: "Clerks", year: 1994, why: "Talky, cheap, funny." },
          { title: "Anchorman", year: 2004, why: "Wrong decade." },
        ],
      }) } }],
      trace: { models: ["test"], calls: [] },
    }),
    verify: async (candidates) => candidates.map((c) => ({ ...c, overview: "Real.", source: "test" })),
  });

  assert.deepEqual(result.movies.map((m) => m.year), [1994, 1994]);
  assert.equal(result.trace.constraint_enforcement.dropped_outside_constraint, 1);
  assert.equal(result.reply, "Two from that year.");
});


test("an impossible constraint is explained, not reported as garbled output", async () => {
  // The model correctly returns no films for a year it cannot know about.
  // Treating an empty list as malformed output threw a 502 over precisely the
  // case the honest explanation exists for — which is what production did.
  const result = await recommend({
    message: "nice comedy from 2026",
    session: { messages: [], preferences: [], shown: [], rejected: [] },
    chat: async () => ({
      choices: [{ message: { content: JSON.stringify({
        reply: "I don't know of any comedies from 2026.",
        movies: [],
      }) } }],
      trace: { models: ["test"], calls: [] },
    }),
    verify: async () => [],
  });

  assert.deepEqual(result.movies, []);
  assert.match(result.reply, /stops around/, "it explains the limit instead of erroring");
});

test("a reply with neither text nor films is still a failure", async () => {
  await assert.rejects(
    () => recommend({
      message: "anything",
      session: { messages: [], preferences: [], shown: [], rejected: [] },
      chat: async () => ({ choices: [{ message: { content: "{}" } }] }),
      verify: async () => [],
    }),
    (err) => err.status === 502
  );
});

// The list stopped at "sixties", so "classic french thrillers from the
// fifties" extracted no constraint at all — nothing told the model, and
// nothing enforced afterwards. It complied anyway, which is the failure mode
// worth naming: a constraint that works only because the model felt like it
// is not a constraint.
test("decades are read as far back as people ask for them", () => {
  assert.deepEqual(
    extractConstraints("classic french thrillers from the fifties").year,
    { min: 1950, max: 1959, label: "from the 1950s" }
  );
  assert.deepEqual(
    extractConstraints("a noir from the forties").year,
    { min: 1940, max: 1949, label: "from the 1940s" }
  );
});
