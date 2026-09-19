// HTTP for the recommendation feature. The thinking lives in
// services/recommendation — this translates between it and Express.
//
// A controller's job here is: read the request, load what the pipeline needs
// from the database, call it, decide the status code, and log what happened. No
// prompts, no model calls, no ranking. When this file starts growing again,
// something belongs in a service.
import Movie from "../models/movie.model.js";
import { logEvent } from "../utils/requestLog.js";
import { MAX_MESSAGE_CHARS } from "../utils/untrusted.js";
import {
  recommend, rememberTurn, recordRejection,
} from "../services/recommendation/index.js";
import { loadSession } from "../services/recommendation/conversation.js";

/**
 * What the pipeline needs to know about somebody's library.
 *
 * Read here rather than inside the service so the pipeline stays free of
 * database access and can be tested without one. A failure degrades to an empty
 * library: taste is a nice-to-have, a suggestion is the product.
 */
async function readLibrary(userId) {
  if (!userId) return { owned: [], liked: [] };
  try {
    const saved = await Movie.find({ user: userId }, "name grade").lean();
    return {
      owned: saved.map((m) => m.name).filter(Boolean),
      liked: saved
        .filter((m) => typeof m.grade === "number" && m.grade >= 8)
        .sort((a, b) => b.grade - a.grade)
        .slice(0, 8)
        .map((m) => m.name),
    };
  } catch (error) {
    console.warn("could not read the library:", error.message);
    return { owned: [], liked: [] };
  }
}

export const getMovieRecommendation = async (req, res) => {
  // `prompt` is what the old single-shot form sent; `message` is what the chat
  // sends. Both accepted so an older client keeps working.
  const message = req.body?.message ?? req.body?.prompt;
  const extraAvoid = Array.isArray(req.body?.exclude) ? req.body.exclude.slice(0, 40) : [];

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      message: "Tell me what you're in the mood for.",
    });
  }
  if (String(message).length > MAX_MESSAGE_CHARS * 4) {
    return res.status(413).json({
      success: false,
      message: `That's a long one — keep it under ${MAX_MESSAGE_CHARS} characters.`,
    });
  }

  try {
    const [session, library] = await Promise.all([
      loadSession(req.userId),
      readLibrary(req.userId),
    ]);

    const result = await recommend({ message, session, library, extraAvoid });

    // Remembering must not cost the answer: if the session cannot be written,
    // the person still gets their films and the next turn starts a little
    // colder.
    let memory = null;
    try {
      memory = await rememberTurn({ session, message, result });
    } catch (error) {
      logEvent("ai.memory_failed", { request_id: req.id, error: error.message });
    }

    logEvent("ai.recommend", {
      request_id: req.id,
      prompt_version: result.prompt_version,
      injection_flagged: result.injection.length,
      ...flatten(result.trace),
      learned: memory?.learned ?? 0,
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      movies: result.movies,
      source: result.trace.verification.source,
      suspicious: result.injection.length > 0,
      trace: publicTrace(result),
    });
  } catch (error) {
    logEvent("ai.failed", {
      request_id: req.id,
      status: error.status || 500,
      error: error.message,
      details: error.details,
    });

    const status = error.status || 502;
    return res.status(status === 429 ? 429 : status).json({
      success: false,
      message:
        error.userMessage ||
        (status === 429
          ? "The recommender is busy right now. Try again in a minute."
          : "The recommender is unavailable right now. The rest of your library still works."),
    });
  }
};

/** POST /api/ai/reject — "not for me", the cheapest signal a person can give. */
export const rejectRecommendation = async (req, res) => {
  const { title, movie } = req.body || {};
  if (!title) {
    return res.status(400).json({ success: false, message: "Which film?" });
  }
  try {
    const session = await loadSession(req.userId);
    await recordRejection({ session, title: String(title).slice(0, 120), movie });
    return res.status(200).json({ success: true });
  } catch (error) {
    logEvent("ai.reject_failed", { request_id: req.id, error: error.message });
    // Losing one rejection is not worth an error in the user's face.
    return res.status(200).json({ success: true, stored: false });
  }
};

/**
 * GET /api/ai/memory — what the system believes about you, and why.
 *
 * Exists because memory that cannot be inspected cannot be trusted or
 * corrected. It is also the honest answer to "what are you storing about me".
 */
export const getMemory = async (req, res) => {
  try {
    const session = await loadSession(req.userId);
    return res.status(200).json({
      success: true,
      preferences: (session?.preferences || []).map((p) => ({
        kind: p.kind, value: p.value, sentiment: p.sentiment,
        source: p.source, weight: p.weight,
      })),
      summary: session?.summary || "",
      turns: session?.messages?.length || 0,
      shown: session?.shown?.length || 0,
      rejected: session?.rejected?.length || 0,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not read your preferences." });
  }
};

/** DELETE /api/ai/memory — forget everything learned. */
export const forgetMemory = async (req, res) => {
  try {
    const session = await loadSession(req.userId);
    if (session) {
      session.messages = [];
      session.summary = "";
      session.preferences = [];
      session.shown = [];
      session.rejected = [];
      await session.save();
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not clear your preferences." });
  }
};

// The trace a user is allowed to see: counts, not prompts.
function publicTrace(result) {
  return {
    // What was read as a hard requirement, and what it cost.
    constraint: result.trace.constraint?.label || null,
    dropped_outside_constraint:
      result.trace.constraint_enforcement?.dropped_outside_constraint || 0,
    source: result.trace.source?.from || "model",
    proposed: result.trace.validation.proposed,
    verified: result.trace.verification.verified,
    unverifiable: result.trace.verification.unverifiable,
    blocked_as_seen: result.trace.filtering.blocked_as_seen,
    shown: result.trace.ranking.shown,
    avoiding: result.trace.context.avoid,
    preferences_used: result.trace.context.preferences,
    ms: result.trace.total_ms,
  };
}

const flatten = (trace) => ({
  constraint: trace.constraint?.label || null,
  constraint_dropped: trace.constraint_enforcement?.dropped_outside_constraint || 0,
  candidates_from: trace.source?.from || "model",
  ctx_turns: trace.context.turns,
  ctx_prefs: trace.context.preferences,
  ctx_avoid: trace.context.avoid,
  ctx_tokens: trace.context.estimated_tokens,
  model_ms: trace.model.ms,
  model: (trace.model.models || []).join(","),
  tokens: trace.model.tokens,
  proposed: trace.validation.proposed,
  verified: trace.verification.verified,
  unverifiable: trace.verification.unverifiable,
  cache_hit_rate: trace.verification.cache.hit_rate,
  blocked: trace.filtering.blocked_as_seen,
  shown: trace.ranking.shown,
  total_ms: trace.total_ms,
});
