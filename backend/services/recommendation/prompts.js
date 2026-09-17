// Every prompt this feature sends, in one place, with a version on it.
//
// Prompts buried in a controller are prompts nobody can diff, roll back or
// compare. Here they are functions of the context object, the version is a
// constant that ships in the response and the logs, and changing the wording is
// a reviewable change rather than an untracked edit.
//
// The system prompt is also where the boundary between instruction and user
// input is drawn. It is not a security control on its own — the enforcement
// lives in validation and verification — but it is the cheap half of
// defence in depth.

import { GUARD, asData } from "../../utils/untrusted.js";

export const PROMPT_VERSION = "recommend-v2";

// The shape the model must answer in. Sent as a schema where the provider
// supports constrained decoding, and repeated in the prompt where it does not.
export const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    movies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          year: { type: "integer" },
          why: { type: "string" },
        },
        required: ["title", "year", "why"],
      },
    },
  },
  required: ["reply", "movies"],
};

const SYSTEM = `You are a film recommender with wide, unsnobbish taste, talking to one person about what to watch.

You only ever name real, released films, with their exact released title and correct year. You never invent a title. Every film you name is checked against a film database before the person sees it, and anything that does not exist is dropped from your answer — so inventing one does not fool anybody, it just wastes a slot.

You are not the source of truth about films. You propose; the application verifies. Never claim a film's rating, box office or streaming availability: you do not have that information and the application will not show it.

${GUARD}

Answer with JSON only.`;

function preferenceLines(preferences) {
  if (!preferences.length) return "";
  const lines = preferences.map((p) => {
    const strength = p.source === "explicit" ? "they said" : "seems to";
    const verb = p.sentiment === "likes" ? "like" : "dislike";
    return `- ${strength} ${verb} ${p.kind}: ${p.value}`;
  });
  return `\n\nWhat we know about their taste (explicit statements are rules, "seems to" is a guess — do not treat a guess as a constraint):\n${lines.join("\n")}`;
}

function historyLines(turns) {
  if (!turns.length) return "";
  const lines = turns.map((t) => `${t.role === "user" ? "Them" : "You"}: ${t.text}`);
  return `\n\nThe last few turns:\n${asData("CONVERSATION", lines.join("\n"))}`;
}

/** The recommendation call: context in, messages for the provider out. */
export function buildRecommendationPrompt(context) {
  const parts = [`They just said:\n${asData("REQUEST", context.message)}`];

  if (context.summary) {
    parts.push(`\n\nNotes from earlier conversations:\n${asData("NOTES", context.summary)}`);
  }
  parts.push(historyLines(context.turns));
  parts.push(preferenceLines(context.preferences));

  if (context.liked.length) {
    parts.push(
      `\n\nFor calibration only — films they rated highly: ${context.liked.join(", ")}. ` +
        `Match the sensibility, not the plot, and never suggest these back.`
    );
  }

  if (context.avoid.length) {
    parts.push(
      `\n\nDO NOT SUGGEST these; they own them, have seen them, or turned them down: ${context.avoid.join(", ")}.`
    );
  }

  parts.push(`

Suggest 8 films.

MAKE THEM DIFFERENT FROM EACH OTHER:
- Span at least three decades, unless they asked for one era.
- At most two films from the same director, franchise or series.
- Include at least two a casual viewer would not have heard of. The eight most obvious films is a worse answer even when every one fits.
- Never pad the list with an acclaimed film that does not fit the request.

If the request is vague, commit to one reading of it rather than hedging across several.

"why" is one sentence, at most 20 words, about THIS request — not a plot summary. If they asked for something lighter, say what makes it lighter.

"reply" is one or two sentences to the person, in the second person, as a human would say it. No lists, no markdown, no restating the titles.

Return json: {"reply":"...","movies":[{"title":"exact released title","year":1999,"why":"..."}]}`);

  return {
    system: SYSTEM,
    user: parts.filter(Boolean).join(""),
    version: PROMPT_VERSION,
  };
}

/**
 * The reply used when every proposed film failed verification.
 *
 * Written here rather than in the controller so the voice stays consistent with
 * the rest of the conversation, and so it is obvious this path exists.
 */
export function nothingFoundReply(hadExclusions) {
  return hadExclusions
    ? "Nothing new there, I'm afraid — everything that came to mind is already in your library or has come up before. Try a different angle?"
    : "I couldn't find real films that fit that one. Try describing the feeling you're after rather than the genre?";
}
