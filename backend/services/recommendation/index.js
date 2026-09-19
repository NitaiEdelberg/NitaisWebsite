// The recommendation pipeline.
//
//   message ─▶ context ─▶ prompt ─▶ model ─▶ validate ─▶ verify ─▶ filter
//                                                                    │
//                          response ◀─ remember ◀─ rank + diversify ◀─┘
//
// Each stage is a module with one job, and this file is the only place that
// knows the order. That matters more than it sounds: when a recommendation
// comes back wrong, the question is always "which stage" — did the model
// propose badly, did verification drop the good ones, did the filter eat them,
// did ranking bury them — and every stage reports its own numbers so the answer
// is in the trace rather than in a guess.
//
// The invariant the whole design exists to protect: the model never decides
// what is true. It proposes titles; the film database decides which exist; this
// file decides which are shown.

import { groundingProvider } from "../../utils/movieLookup.js";
import { providers } from "../providers.js";
import { findInjection, sanitiseMessage } from "../../utils/untrusted.js";
import { movieFactCache } from "../../utils/cache.js";
import { buildContext, estimateTokens } from "./context.js";
import { catalogueAvailable, discover } from "./catalogue.js";
import { enforce, explainShortfall, extractConstraints } from "./constraints.js";
import {
  appendTurn, compactIfNeeded, rememberRejected, rememberShown,
} from "./conversation.js";
import { extractPreferences, inferFromRejections, mergePreferences } from "./memory.js";
import { RECOMMENDATION_SCHEMA, buildRecommendationPrompt, nothingFoundReply } from "./prompts.js";
import { parseRecommendation } from "./validate.js";
import { rankAndDiversify } from "./rank.js";

export const RESULT_LIMIT = 5;

// Used when the candidates came from the catalogue rather than the model, so
// there is no model-written sentence to show.
const defaultReply = (constraints) =>
  constraints?.year
    ? `Here's what actually came out ${constraints.year.label}, most talked-about first.`
    : "Here are a few.";

/**
 * One turn of the conversation.
 *
 * `session` may be null for a request without a signed-in user; everything then
 * degrades to a stateless recommendation rather than failing. `library` carries
 * the caller's owned and highly-rated titles, read by the controller so this
 * stays free of database queries and therefore testable without one.
 */
export async function recommend({
  message,
  session,
  library = {},
  extraAvoid = [],
  chat = providers.chat,
  verify = providers.verify,
  now = Date.now,
}) {
  const startedAt = now();
  const clean = sanitiseMessage(message);
  if (!clean) {
    const error = new Error("empty message");
    error.status = 400;
    error.userMessage = "Tell me what you're in the mood for.";
    throw error;
  }

  // Reported, never blocking: the message belongs to the person who typed it,
  // and the defences that matter are the ones after the model, not before it.
  const injection = findInjection(clean);

  // What was actually asked for, as a rule rather than as words in a prompt.
  const constraints = extractConstraints(clean);
  const context = buildContext({ message: clean, session, library, extraAvoid, constraints });

  const stages = {
    context: { ...context.sizes, estimated_tokens: estimateTokens(context) },
    constraint: constraints.year
      ? { ...constraints.year, needs_catalogue: constraints.needsCatalogue }
      : null,
  };

  // ---- where the candidates come from ------------------------------------
  //
  // A request for films newer than the model's training data is a retrieval
  // problem, not a generation problem: asking the model produces confident
  // guesses, and no prompt fixes that. Those go to the catalogue; everything
  // else goes to the model, which is far better at "like The Dictator".
  let parsed = null;
  let candidates = [];
  let preVerified = false;
  let modelReply = "";
  // Which prompt produced this answer — "catalogue" when no prompt did.
  let promptVersion = "catalogue";

  if (constraints.needsCatalogue && catalogueAvailable()) {
    const catalogueStarted = now();
    const found = await discover({ constraints, message: clean, limit: 10 });
    candidates = found.movies;
    preVerified = true;
    stages.source = { from: "catalogue", found: candidates.length, genre: found.genre };
    stages.model = { ms: now() - catalogueStarted, models: [], tokens: 0 };
  } else {
    const prompt = buildRecommendationPrompt(context);
    promptVersion = prompt.version;
    const modelStarted = now();
    const completion = await chat({
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      schema: RECOMMENDATION_SCHEMA,
    });
    stages.model = {
      ms: now() - modelStarted,
      models: completion.trace?.models || [],
      tokens: (completion.trace?.calls || []).reduce((sum, c) => sum + (c.tokens || 0), 0),
    };
    stages.source = { from: "model", found: 0 };

    // ---- the application validates ---------------------------------------
    parsed = parseRecommendation(completion.choices?.[0]?.message?.content);
    stages.validation = { proposed: parsed.movies.length, problems: parsed.problems };

    if (!parsed.ok) {
      const error = new Error("unusable model output");
      error.status = 502;
      error.details = parsed.problems;
      error.userMessage = "That came back garbled. Try asking again?";
      throw error;
    }
    candidates = parsed.movies;
    modelReply = parsed.reply;
    stages.source.found = candidates.length;
  }

  stages.validation = stages.validation || { proposed: candidates.length, problems: [] };

  // ---- the film database decides what exists -----------------------------
  const verifyStarted = now();
  // Catalogue results came FROM the film database; re-verifying them against it
  // is a round trip to be told what it just said.
  const verified = preVerified ? candidates : await verify(candidates);
  const byTitle = new Map(candidates.map((m) => [m.title.toLowerCase(), m]));
  const withReasons = verified.map((movie) => ({
    ...movie,
    // The model's reason survives verification; its facts do not.
    why: movie.why || byTitle.get((movie.title || "").toLowerCase())?.why || "",
  }));
  stages.verification = {
    ms: now() - verifyStarted,
    verified: verified.length,
    // Titles the model named that no real film matches. The number this whole
    // design exists to keep at zero in what reaches the user.
    unverifiable: candidates.length - verified.length,
    source: preVerified ? "tmdb" : groundingProvider(),
    cache: movieFactCache.stats(),
  };

  // ---- the stated requirement is enforced here, not hoped for ------------
  //
  // After verification, because the model's claimed year is a guess and
  // verification replaces it with the real one. Filtering on the guess would
  // drop films that qualify and keep films that do not.
  const { kept, dropped } = enforce(withReasons, constraints);
  stages.constraint_enforcement = {
    dropped_outside_constraint: dropped.length,
    examples: dropped.slice(0, 3).map((m) => `${m.title} (${m.year || "?"})`),
  };

  // ---- this file decides what is shown -----------------------------------
  const blocked = new Set(context.avoid.map((t) => t.toLowerCase().trim()));
  const fresh = kept.filter((m) => !blocked.has((m.title || "").toLowerCase().trim()));
  stages.filtering = { blocked_as_seen: kept.length - fresh.length };

  const movies = rankAndDiversify(fresh, { limit: RESULT_LIMIT });
  stages.ranking = { shown: movies.length, from: fresh.length };

  // A constraint that could not be honoured is said out loud. Returning a film
  // from 1999 for a request about 2026 and letting the person notice is the
  // failure this whole path exists to prevent.
  const shortfall = explainShortfall(constraints, {
    catalogueAvailable: catalogueAvailable(),
    foundAny: movies.length > 0,
  });

  const reply =
    shortfall ||
    (movies.length ? modelReply || defaultReply(constraints) : nothingFoundReply(context.avoid.length > 0));

  return {
    reply,
    movies,
    injection,
    prompt_version: promptVersion,
    trace: { ...stages, total_ms: now() - startedAt },
  };
}

/**
 * Write down what this turn taught us.
 *
 * Separated from `recommend` because remembering is a side effect and
 * recommending is not: a caller that wants a suggestion without changing
 * anybody's stored taste can have one, and the tests can check the pipeline
 * without a database.
 */
export async function rememberTurn({ session, message, result, chat = providers.chat }) {
  if (!session) return null;

  appendTurn(session, "user", message);
  appendTurn(session, "assistant", result.reply, result.movies.map((m) => m.title));
  rememberShown(session, result.movies.map((m) => m.title));

  // Only what somebody actually said becomes an explicit preference. Inferences
  // arrive separately, through feedback, and have to recur before they count.
  const stated = await extractPreferences(message, { chat });
  if (stated.length) {
    session.preferences = mergePreferences(session.preferences, stated, "explicit");
  }

  await compactIfNeeded(session, { chat });
  await session.save();
  return { learned: stated.length, turns: session.messages.length };
}

/**
 * "Not for me" — the cheapest useful signal a person can give.
 *
 * Recorded as a hard block on that title, and as a weak, repeated-only
 * inference about its genre. Two rejections are not a stated dislike, and
 * treating them as one is how a recommender talks itself into a corner.
 */
export async function recordRejection({ session, title, movie = null }) {
  if (!session || !title) return null;
  rememberRejected(session, [title]);

  if (movie) {
    const inferred = inferFromRejections([title], [movie]);
    if (inferred.length) {
      session.preferences = mergePreferences(session.preferences, inferred, "inferred");
    }
  }

  await session.save();
  return { rejected: session.rejected.length };
}
