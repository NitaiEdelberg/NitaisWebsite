// Choosing what the model gets to see.
//
// This is the file that decides the answer to "why don't you just send the
// whole conversation". Because context is a budget, not a container: every
// token spent on a pleasantry from last Tuesday is a token not spent on what
// somebody wants tonight, and it is paid for on every request forever.
//
// So the context is assembled from four sources with a fixed shape:
//
//   the request        what they just asked for — always included, verbatim
//   recent turns       the last few exchanges, because "no, lighter" means
//                      nothing without them
//   durable notes      one summary standing in for everything older
//   taste              explicit preferences, plus inferences that recurred
//   library facts      what they own and rated, as calibration
//
// Everything here is bounded. Not "usually small" — bounded, with the numbers
// in one place so the worst case can be reasoned about rather than discovered.

import { activePreferences } from "./memory.js";
import { recentTurns } from "./conversation.js";

// Budgets, in items rather than tokens: items are what the code controls, and
// the per-item caps below make the token count follow.
export const LIMITS = {
  turns: 6,
  preferences: 12,
  likedFilms: 8,
  avoidTitles: 40,
  summaryChars: 700,
};

/**
 * Assemble everything the prompt builder is allowed to use.
 *
 * Returns plain data, not a string: the prompt builder decides wording, this
 * decides relevance, and keeping those apart is what makes both testable.
 */
export function buildContext({ message, session, library = {}, extraAvoid = [], constraints = null }) {
  const preferences = activePreferences(session?.preferences || []).slice(
    0,
    LIMITS.preferences
  );

  const turns = recentTurns(session, LIMITS.turns).map((turn) => ({
    role: turn.role,
    text: turn.text,
  }));

  // Rejections first: "never show me this again" outranks "you have seen this".
  const avoid = [
    ...new Set([
      ...(session?.rejected || []),
      ...extraAvoid,
      ...(library.owned || []),
      ...(session?.shown || []),
    ]),
  ].slice(0, LIMITS.avoidTitles);

  return {
    message,
    // A phrase like "from 2026" or "from the 1990s", or null. Told to the model
    // so its own ordering respects it, and enforced in code regardless.
    constraint: constraints?.describe || null,
    turns,
    summary: (session?.summary || "").slice(0, LIMITS.summaryChars),
    preferences,
    liked: (library.liked || []).slice(0, LIMITS.likedFilms),
    avoid,
    // Reported back to the caller so a slow or strange request can be explained
    // by what went into it, rather than guessed at.
    sizes: {
      constrained: Boolean(constraints?.year),
      turns: turns.length,
      preferences: preferences.length,
      avoid: avoid.length,
      liked: Math.min((library.liked || []).length, LIMITS.likedFilms),
      summary_chars: (session?.summary || "").length,
    },
  };
}

/**
 * A rough token estimate, for logging and for the budget check.
 *
 * Four characters per token is wrong in the third decimal place and right
 * enough to notice a context that has doubled. An exact count would need the
 * provider's tokeniser, which is a dependency this does not need to carry to
 * answer "is this getting big".
 */
export function estimateTokens(context) {
  const text = [
    context.message,
    context.summary,
    ...context.turns.map((t) => t.text),
    ...context.preferences.map((p) => `${p.kind} ${p.value}`),
    ...context.liked,
    ...context.avoid,
  ].join(" ");
  return Math.ceil(text.length / 4);
}
