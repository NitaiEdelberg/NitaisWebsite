import dotenv from "dotenv";
import { verifyCandidates, groundingProvider } from "../utils/movieLookup.js";
import { groqChat } from "../utils/groqChat.js";
dotenv.config();

// Movie recommendations via Groq (OpenAI-compatible, free tier, no credit card).
// Set GROQ_API_KEY in the environment. Get a key at https://console.groq.com/keys
// Model selection and the retired-model fallback live in utils/groqChat.js.

// Ask the LLM for candidate titles only — NOT for facts we'll display.
// Everything the user sees (title, year, poster, overview) is replaced by real
// data from the movie database in the grounding step, so the model inventing a
// film or a wrong year can't leak through: an invented title simply fails
// verification and gets dropped.
async function proposeCandidates(prompt, exclude = []) {
  const excludeNote = exclude.length
    ? `\nDo NOT suggest any of these already-shown films: ${exclude.join(", ")}.`
    : "";

  const body = {
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a film expert. You only ever name real, released movies " +
          "that exist on TMDb/IMDb. Never invent titles. Respond with JSON only.",
      },
      {
        role: "user",
        content:
          `Suggest 6 real, existing movies that fit this request: "${prompt}".` +
          excludeNote +
          `\nReturn strict JSON of the form: {"movies":[{"title":"exact title","year":1999}, ...]}. ` +
          `Use the exact released title and correct release year for each.`,
      },
    ],
  };

  const data = await groqChat(body);

  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : parsed.movies || parsed.results || [];
  return list
    .filter((m) => m && m.title)
    .map((m) => ({ title: String(m.title).trim(), year: m.year }));
}

export const getMovieRecommendation = async (req, res) => {
  const { prompt, exclude } = req.body;

  if (!prompt || !String(prompt).trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Describe what you're in the mood for." });
  }

  try {
    const candidates = await proposeCandidates(
      String(prompt).trim(),
      Array.isArray(exclude) ? exclude.slice(0, 20) : []
    );

    // Ground every candidate against a real movie database; keep only the ones
    // that actually exist, with canonical data + real posters.
    const movies = await verifyCandidates(candidates);

    if (!movies.length) {
      return res.status(200).json({
        success: true,
        movies: [],
        source: groundingProvider(),
        message:
          "Couldn't find verified matches for that — try describing the vibe a little differently.",
      });
    }

    return res.status(200).json({
      success: true,
      movies: movies.slice(0, 5),
      source: groundingProvider(),
    });
  } catch (err) {
    // The upstream detail (dead model id, rate limit, bad key) belongs in the
    // logs; the visitor gets something they can act on instead of "AI API error".
    console.error("AI recommend error:", err.message, JSON.stringify(err.details || ""));
    const upstream = err.status || 500;
    const message =
      upstream === 429
        ? "The AI service is busy right now. Try again in a minute."
        : "The AI recommender is unavailable right now. The rest of the library still works.";
    return res.status(upstream === 429 ? 429 : 502).json({ success: false, message });
  }
};
