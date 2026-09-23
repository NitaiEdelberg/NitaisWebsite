// Hard constraints, extracted from the request and enforced in code.
//
// The failure this exists for: someone asked for "a new comedy film from 2026,
// similar to The Dictator" and got films from 1999, 2004 and 2010. Three things
// went wrong at once, and only one of them was the model's fault.
//
//   1. Nothing extracted "2026" as a requirement. It was just words in a prompt.
//   2. Nothing enforced it afterwards, so three films from the wrong century
//      sailed through verification and ranking.
//   3. The prompt actively asked for a spread of decades, which is right for
//      "something funny" and exactly wrong for "something from 2026".
//
// And underneath all three, the thing no prompt can fix: a language model
// cannot know about films released after its training data ends. Asking it for
// 2026 releases does not produce 2026 releases, it produces confident guesses.
// So a request for recency is routed to a real catalogue, or answered honestly —
// never quietly satisfied with something from 1999.

// What the model can be expected to know about. Films released after this are
// not in its training data, whatever it says. Configurable because the answer
// changes with every model release.
export const MODEL_KNOWLEDGE_YEAR = Number(process.env.MODEL_KNOWLEDGE_YEAR || 2025);

const THIS_YEAR = new Date().getFullYear();

// Written as patterns rather than handed to the model because a year is not a
// judgement call: "from 2026" means 2026, and a regex cannot decide otherwise
// on a bad day.
// Most specific first, because the first match wins: "before 2000" has to be
// read before the bare year inside it, and an explicit "from 1994" before the
// word "new" elsewhere in the same sentence.
const PATTERNS = [
  // Ranges, which contain a year and must be read before the bare-year rule.
  [/\bbefore\s+((?:19|20)\d{2})\b/i, (m) => ({ max: +m[1] - 1, label: `before ${m[1]}` })],
  [/\b(?:after|since)\s+((?:19|20)\d{2})\b/i, (m) => ({ min: +m[1] + 1, label: `after ${m[1]}` })],
  [/\bbetween\s+((?:19|20)\d{2})\s+and\s+((?:19|20)\d{2})\b/i,
   (m) => ({ min: Math.min(+m[1], +m[2]), max: Math.max(+m[1], +m[2]), label: `between ${m[1]} and ${m[2]}` })],
  [/\blast\s+(\d{1,2})\s+years?\b/i, (m) => ({ min: THIS_YEAR - +m[1], label: `from the last ${m[1]} years` })],

  // Decades, written either way round: "1990s" and "90s" mean the same thing.
  [/\b((?:19|20)\d0)s\b/i, (m) => ({ min: +m[1], max: +m[1] + 9, label: `from the ${m[1]}s` })],
  [/\b['’]?(\d0)s\b/i, (m) => {
    // "90s" is the 1990s; "20s" and "10s" are this century, not the last.
    const decade = +m[1] >= 30 ? 1900 + +m[1] : 2000 + +m[1];
    return { min: decade, max: decade + 9, label: `from the ${decade}s` };
  }],
  [/\bnineties\b/i, () => ({ min: 1990, max: 1999, label: "from the 1990s" })],
  [/\beighties\b/i, () => ({ min: 1980, max: 1989, label: "from the 1980s" })],
  [/\bseventies\b/i, () => ({ min: 1970, max: 1979, label: "from the 1970s" })],
  [/\bsixties\b/i, () => ({ min: 1960, max: 1969, label: "from the 1960s" })],
  [/\bfifties\b/i, () => ({ min: 1950, max: 1959, label: "from the 1950s" })],
  [/\bforties\b/i, () => ({ min: 1940, max: 1949, label: "from the 1940s" })],

  // A specific year, qualified or bare.
  [/\b(?:from|in|of)\s+((?:19|20)\d{2})\b/i, (m) => ({ min: +m[1], max: +m[1], label: `from ${m[1]}` })],
  [/\b((?:19|20)\d{2})\b/, (m) => ({ min: +m[1], max: +m[1], label: `from ${m[1]}` })],

  // The vague ones, last, because any of the above is a better reading.
  [/\bthis year\b/i, () => ({ min: THIS_YEAR, max: THIS_YEAR, label: "from this year" })],
  [/\b(?:new|latest|newest|just came out|out now)\b/i, () => ({ min: THIS_YEAR - 1, label: "new" })],
  [/\brecent(?:ly)?\b/i, () => ({ min: THIS_YEAR - 3, label: "recent" })],
  [/\bmodern\b/i, () => ({ min: 2010, label: "modern" })],
  [/\b(?:classic|old)\b/i, () => ({ max: 1990, label: "older" })],
];

/**
 * Read the hard requirements out of a request.
 *
 * Returns `{ year: {min, max, label} | null, needsCatalogue, ... }`. Absent
 * constraints are null rather than defaults, so "no year mentioned" and "any
 * year is fine" stay the same thing and nothing is silently narrowed.
 */
export function extractConstraints(message) {
  const text = String(message || "");
  let year = null;

  for (const [pattern, build] of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const found = build(match);
    // First match wins: the patterns run most specific to vaguest, so an
    // explicit "from 2026" is not overwritten by the word "new" later on.
    year = {
      min: found.min ?? null,
      max: found.max ?? null,
      label: found.label,
    };
    break;
  }

  // Does answering this require knowing about films the model cannot know?
  const needsCatalogue = Boolean(year?.min && year.min > MODEL_KNOWLEDGE_YEAR);

  return {
    year,
    needsCatalogue,
    // What to tell the model, so its own ordering respects the constraint even
    // though the enforcement below does not depend on it.
    describe: year ? year.label : null,
  };
}

/** Does a film satisfy the year constraint? A film with no known year does not. */
export function satisfies(movie, constraints) {
  if (!constraints?.year) return true;
  const { min, max } = constraints.year;
  if (!movie.year) return false;
  if (min && movie.year < min) return false;
  if (max && movie.year > max) return false;
  return true;
}

/**
 * Enforce the constraint after verification.
 *
 * Deliberately after: the model's claimed year is a guess, and verification
 * replaces it with the real one. Filtering on the guess would drop films that
 * do qualify and keep films that do not.
 */
export function enforce(movies, constraints) {
  if (!constraints?.year) return { kept: movies, dropped: [] };
  const kept = [];
  const dropped = [];
  for (const movie of movies) {
    (satisfies(movie, constraints) ? kept : dropped).push(movie);
  }
  return { kept, dropped };
}

/**
 * What to say when a constraint cannot be honoured.
 *
 * The important case is a request for films newer than the model knows about,
 * with no catalogue configured to look them up. The honest answer names the
 * limit rather than quietly returning something from 1999 and hoping.
 */
export function explainShortfall(constraints, { catalogueAvailable, foundAny }) {
  // With no year constraint there is nothing here to explain, and the caller
  // has a better message for "everything was already shown" than this does.
  if (!constraints?.year) return null;

  if (constraints.needsCatalogue && !catalogueAvailable) {
    return (
      `I can't reliably suggest films ${constraints.year.label} — what I know ` +
      `about films stops around ${MODEL_KNOWLEDGE_YEAR}, and anything I offered ` +
      `for this year would be a guess dressed up as a fact. Ask me for something ` +
      `up to ${MODEL_KNOWLEDGE_YEAR} and I'll do a proper job, or tell me the ` +
      `kind of thing you want and I'll find the closest I can stand behind.`
    );
  }

  if (!foundAny) {
    return (
      `Nothing I could verify came back ${constraints.year.label}. ` +
      `Widening the years would give me more to work with.`
    );
  }
  return null;
}
