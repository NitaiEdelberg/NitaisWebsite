// Short-term memory: the last few turns, and a summary of everything before.
//
// The naive version of a chat feature appends every message to an array and
// sends the array to the model. That works for a week and then costs a fortune,
// slows down, and eventually exceeds the context window — and long before any
// of that, it stops helping: the model pays as much attention to what somebody
// wanted three weeks ago as to what they just asked for.
//
// So the conversation is bounded. The most recent turns are kept verbatim
// because that is where the meaning of "no, something lighter" lives. Older
// turns are folded into one short summary, which is regenerated from the turns
// falling out of the window rather than from the whole history, so the cost of
// compaction does not grow either.
//
// Compaction uses the model, and the model can be down. If it is, the oldest
// turns are dropped with a marker rather than kept forever: losing old context
// is a worse outcome than a failed request, but only slightly, and the
// alternative is an unbounded array.

import ChatSession from "../../models/chatSession.model.js";
import { providers } from "../providers.js";
import { asData } from "../../utils/untrusted.js";

// Turns kept verbatim. Six is three exchanges — enough for "something like
// Interstellar" / "seen it" / "lighter then" to still be visible.
export const KEEP_VERBATIM = 6;
// Above this, the oldest turns are summarised away.
export const COMPACT_AT = 12;
// Caps that stop one enthusiastic session from growing without limit.
const MAX_SHOWN = 120;
const MAX_REJECTED = 60;

export async function loadSession(userId) {
  if (!userId) return null;
  const existing = await ChatSession.findOne({ user: userId });
  return existing || new ChatSession({ user: userId });
}

export function recentTurns(session, limit = KEEP_VERBATIM) {
  if (!session?.messages?.length) return [];
  return session.messages.slice(-limit);
}

/** Add a turn. Does not save — the caller decides when the request succeeded. */
export function appendTurn(session, role, text, titles = []) {
  if (!session || !text) return session;
  session.messages.push({
    role,
    text: String(text).slice(0, 2000),
    titles: titles.slice(0, 10),
  });
  return session;
}

export function rememberShown(session, titles = []) {
  if (!session) return session;
  const merged = [...new Set([...titles, ...session.shown])];
  session.shown = merged.slice(0, MAX_SHOWN);
  return session;
}

export function rememberRejected(session, titles = []) {
  if (!session) return session;
  const merged = [...new Set([...titles, ...session.rejected])];
  session.rejected = merged.slice(0, MAX_REJECTED);
  return session;
}

const SUMMARY_SCHEMA_HINT =
  'Return json of the form {"summary": "..."} and nothing else.';

/**
 * Fold the turns that are falling out of the window into the running summary.
 *
 * Only the departing turns are summarised, together with the previous summary —
 * not the whole history — so this costs the same whether the conversation is
 * ten turns old or a thousand.
 */
export async function compactIfNeeded(session, { chat = providers.chat } = {}) {
  if (!session || session.messages.length <= COMPACT_AT) return session;

  const departing = session.messages.slice(0, session.messages.length - KEEP_VERBATIM);
  const kept = session.messages.slice(-KEEP_VERBATIM);
  const transcript = departing
    .map((m) => `${m.role === "user" ? "Them" : "Us"}: ${m.text}`)
    .join("\n");

  try {
    const data = await chat({
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You compress a film-recommendation conversation into durable notes. " +
            "Keep what would still matter next week: stated tastes, films they " +
            "have seen or rejected, constraints they repeated. Drop pleasantries, " +
            "one-off moods, and anything about a single request. Never invent a " +
            "preference that was not expressed. " + SUMMARY_SCHEMA_HINT,
        },
        {
          role: "user",
          content:
            `Previous notes:\n${session.summary || "(none)"}\n\n` +
            `Conversation to fold in:\n${asData("CONVERSATION", transcript)}\n\n` +
            "Return json with one key, summary: at most 120 words of notes.",
        },
      ],
    });
    const parsed = JSON.parse(data.choices[0].message.content);
    if (parsed?.summary) session.summary = String(parsed.summary).slice(0, 1500);
  } catch (error) {
    // Compaction is best-effort. A conversation that cannot be summarised is
    // still better trimmed than left to grow unboundedly, so the old turns go
    // and the summary says so rather than silently losing them.
    console.warn("conversation compaction failed:", error.message);
    session.summary = [
      session.summary,
      `(${departing.length} earlier turns were dropped without being summarised.)`,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1500);
  }

  session.messages = kept;
  return session;
}
