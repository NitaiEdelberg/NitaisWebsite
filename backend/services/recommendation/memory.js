// Long-term memory: what we believe about someone's taste, and how sure we are.
//
// The distinction this file exists for: "I hate horror" is a rule, and "they
// have picked three nineties thrillers" is a hint. Storing both as facts is how
// a recommender ends up confidently wrong — one offhand click becomes a
// permanent belief nobody can see or correct.
//
// So every preference carries its source. Explicit ones come from something the
// person said and are treated as constraints. Inferred ones come from
// behaviour, carry a weight, need repetition before they influence anything,
// and lose to an explicit preference that contradicts them.
//
// Extraction of explicit preferences is done by the model, because "I'm bored
// of superhero stuff" is not a pattern match. Everything the model returns is
// validated against a closed vocabulary before it is stored — the model
// proposes, this file decides.

import { providers } from "../providers.js";
import { asData } from "../../utils/untrusted.js";

export const KINDS = ["genre", "tone", "era", "language", "theme", "avoid"];
const SENTIMENTS = ["likes", "dislikes"];

// An inference has to recur before it is allowed to shape a recommendation.
// One click is noise; three is a pattern.
export const INFERRED_THRESHOLD = 3;
const MAX_PREFERENCES = 40;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    preferences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS },
          value: { type: "string" },
          sentiment: { type: "string", enum: SENTIMENTS },
        },
        required: ["kind", "value", "sentiment"],
      },
    },
  },
  required: ["preferences"],
};

/**
 * Pull durable preferences out of what someone just said.
 *
 * Deliberately conservative: a mood for tonight is not a preference, and the
 * prompt says so. Over-extraction is the failure mode that makes this kind of
 * memory annoying — you mention a musical once and the system decides you love
 * musicals.
 */
export async function extractPreferences(text, { chat = providers.chat } = {}) {
  if (!text || !text.trim()) return [];

  try {
    const data = await chat({
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract DURABLE film preferences somebody states about " +
            "themselves. A durable preference is one that would still be true " +
            "next month: 'I can't stand horror', 'I love slow French cinema'. " +
            "A mood for tonight is NOT durable: 'something light this evening', " +
            "'in the mood for a thriller'. When in doubt, extract nothing — a " +
            "missed preference costs nothing, an invented one is remembered " +
            "forever. Respond with JSON only.",
        },
        {
          role: "user",
          content:
            `Extract durable preferences from this message, or return an empty list.\n\n` +
            `${asData("MESSAGE", text)}\n\n` +
            `Return json: {"preferences":[{"kind":"genre|tone|era|language|theme|avoid",` +
            `"value":"short lowercase phrase","sentiment":"likes|dislikes"}]}`,
        },
      ],
      schema: EXTRACT_SCHEMA,
    });

    const parsed = JSON.parse(data.choices[0].message.content);
    return sanitise(parsed?.preferences);
  } catch (error) {
    // Memory is an enhancement. A failure here must not cost the recommendation.
    console.warn("preference extraction failed:", error.message);
    return [];
  }
}

/** The model proposes; this decides. Anything off-vocabulary is dropped. */
export function sanitise(raw) {
  if (!Array.isArray(raw)) return [];
  const clean = [];
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const kind = String(item.kind || "").toLowerCase();
    const sentiment = String(item.sentiment || "").toLowerCase();
    const value = String(item.value || "").toLowerCase().trim().slice(0, 60);
    if (!KINDS.includes(kind) || !SENTIMENTS.includes(sentiment) || value.length < 2) {
      continue;
    }
    clean.push({ kind, value, sentiment });
  }
  return clean;
}

/**
 * Merge new observations into what we already believe.
 *
 * The rules, in order:
 *   - an explicit statement overwrites an inference about the same thing;
 *   - an inference never overwrites an explicit statement;
 *   - a repeat raises the weight rather than adding a duplicate;
 *   - a reversal ("actually I love horror") flips the sentiment instead of
 *     leaving two contradictory beliefs in the store.
 */
export function mergePreferences(existing = [], observed = [], source = "explicit") {
  const merged = existing.map((p) => ({ ...(p.toObject ? p.toObject() : p) }));

  for (const item of observed) {
    const match = merged.find((p) => p.kind === item.kind && p.value === item.value);

    if (!match) {
      merged.push({ ...item, source, weight: 1, updatedAt: new Date() });
      continue;
    }

    if (source === "inferred" && match.source === "explicit") {
      // They told us. A guess does not get to argue.
      continue;
    }

    if (match.sentiment !== item.sentiment) {
      // A reversal: believe the newer statement rather than keeping both.
      match.sentiment = item.sentiment;
      match.weight = source === "explicit" ? 1 : Math.max(1, match.weight - 1);
    } else {
      match.weight += 1;
    }
    match.source = source === "explicit" ? "explicit" : match.source;
    match.updatedAt = new Date();
  }

  // Keep the strongest, newest beliefs if this ever grows large.
  return merged
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "explicit" ? -1 : 1;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .slice(0, MAX_PREFERENCES);
}

/**
 * The preferences allowed to influence this request.
 *
 * Everything explicit, plus inferences that have recurred enough to have earned
 * it. This is the function that keeps a single stray click from turning into a
 * belief the system acts on.
 */
export function activePreferences(preferences = []) {
  return preferences
    .map((p) => (p.toObject ? p.toObject() : p))
    .filter((p) => p.source === "explicit" || p.weight >= INFERRED_THRESHOLD);
}

/**
 * What the person turned down, as a weak signal about genre and tone.
 *
 * Kept separate from stated preferences on purpose: rejecting two films is not
 * the same as saying you dislike a genre, so these enter as inferences with the
 * usual repetition requirement.
 */
export function inferFromRejections(rejectedTitles = [], candidates = []) {
  const byTitle = new Map(candidates.map((c) => [c.title, c]));
  const observed = [];
  for (const title of rejectedTitles) {
    const movie = byTitle.get(title);
    if (movie?.genre) {
      observed.push({ kind: "genre", value: String(movie.genre).toLowerCase(), sentiment: "dislikes" });
    }
  }
  return observed;
}
