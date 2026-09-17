import dotenv from "dotenv";
import { verifyCandidates, groundingProvider } from "../utils/movieLookup.js";
import { groqChat } from "../utils/groqChat.js";
import Movie from "../models/movie.model.js";
dotenv.config();

// Movie recommendations via Groq (OpenAI-compatible, free tier, no credit card).
// Set GROQ_API_KEY in the environment. Get a key at https://console.groq.com/keys
// Model selection and the retired-model fallback live in utils/groqChat.js.

// Ask the LLM for candidate titles only — NOT for facts we'll display.
// Everything the user sees (title, year, poster, overview) is replaced by real
// data from the movie database in the grounding step, so the model inventing a
// film or a wrong year can't leak through: an invented title simply fails
// verification and gets dropped.
async function proposeCandidates(prompt, exclude = [], taste = []) {
  const excludeNote = exclude.length
    ? `\n\nALREADY SEEN — do not suggest any of these: ${exclude.join(", ")}.`
    : "";

  // What the person already saved and rated highly, as a taste signal rather
  // than as a request. Without it every session starts from zero and the same
  // crowd-pleasers come back.
  const tasteNote = taste.length
    ? `\n\nFor calibration only, films this person rated highly: ${taste.join(", ")}. ` +
      "Match the sensibility, do not match the plot, and never suggest these back."
    : "";

  const body = {
    // Lower than the 0.8 this used to run at. Temperature was doing the job
    // variety should do: it bought different answers by making the model
    // sloppier about titles and years, and every sloppy title dies in the
    // grounding step anyway. The spread rules below buy variety honestly.
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a film expert with wide, unsnobbish taste. You only ever name " +
          "real, released films that exist on TMDb or IMDb, with their exact " +
          "released title and correct year. You never invent a title, and you " +
          "never pad a list with famous films that do not fit the request. " +
          "Respond with JSON only.",
      },
      {
        role: "user",
        content:
          `Suggest 8 real films for this request: "${prompt}".` +
          tasteNote +
          excludeNote +
          `

MAKE THE EIGHT DIFFERENT FROM EACH OTHER:
- Span at least three decades, unless the request asks for one era.
- At most three films from the same director, franchise or series.
- Include at least two that a casual viewer would not have heard of. A list of the eight most obvious films is a worse answer even when every one of them fits.
- Do not include a film only because it is acclaimed. It has to fit the request.

IF THE REQUEST IS VAGUE, commit to one reading of it rather than hedging across several — a coherent eight beats a scattered eight.

Return strict JSON: {"movies":[{"title":"exact released title","year":1999,"why":"at most 12 words on why it fits the request"}]}`,
      },
    ],
  };

  const data = await groqChat(body);

  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    return { candidates: [], trace: data.trace };
  }
  const list = Array.isArray(parsed) ? parsed : parsed.movies || parsed.results || [];
  const candidates = list
    .filter((m) => m && m.title)
    .map((m) => ({ title: String(m.title).trim(), year: m.year, why: m.why }));
  return { candidates, trace: data.trace };
}


// Titles already in this person's library. Suggesting a film they have already
// saved is the most obviously useless thing this feature can do, and it was
// doing it — the exclusion list only ever held what the browser had shown in
// the current session.
async function savedTitles(userId) {
  if (!userId) return { seen: [], liked: [] };
  try {
    const saved = await Movie.find({ user: userId }, "name grade").lean();
    return {
      seen: saved.map((m) => m.name).filter(Boolean),
      liked: saved
        .filter((m) => typeof m.grade === "number" && m.grade >= 8)
        .sort((a, b) => b.grade - a.grade)
        .slice(0, 8)
        .map((m) => m.name),
    };
  } catch (err) {
    // Taste is a nice-to-have; a database hiccup must not cost the suggestion.
    console.warn("could not read the library for taste:", err.message);
    return { seen: [], liked: [] };
  }
}

export const getMovieRecommendation = async (req, res) => {
  const { prompt, exclude } = req.body;

  if (!prompt || !String(prompt).trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Describe what you're in the mood for." });
  }

  const started = Date.now();

  try {
    const { seen, liked } = await savedTitles(req.userId);
    const fromClient = Array.isArray(exclude) ? exclude.slice(0, 40) : [];
    // Everything the person has already been shown or already owns, de-duped.
    const avoid = [...new Set([...fromClient, ...seen])].slice(0, 60);

    const { candidates, trace } = await proposeCandidates(
      String(prompt).trim(), avoid, liked
    );

    // Ground every candidate against a real movie database; keep only the ones
    // that actually exist, with canonical data + real posters.
    const verified = await verifyCandidates(candidates);

    // The model was told not to repeat these, which is not the same as it
    // obeying. Enforced here, because "already in your library" is the one
    // suggestion that is certainly useless.
    const blocked = new Set(avoid.map((t) => t.toLowerCase().trim()));
    const movies = verified.filter((m) => !blocked.has((m.title || "").toLowerCase().trim()));

    const report = {
      proposed: candidates.length,
      verified: verified.length,
      // Dropped by the grounding step: titles the model named that no real
      // film matches. The number this feature exists to keep at zero.
      unverifiable: candidates.length - verified.length,
      repeats_blocked: verified.length - movies.length,
      excluded: avoid.length,
      taste_signals: liked.length,
      ms: Date.now() - started,
      models: trace?.models || [],
      tokens: (trace?.calls || []).reduce((sum, c) => sum + (c.tokens || 0), 0),
    };
    console.log("ai.recommend", JSON.stringify(report));

    if (!movies.length) {
      return res.status(200).json({
        success: true,
        movies: [],
        source: groundingProvider(),
        trace: report,
        message: avoid.length
          ? "Nothing new for that one — everything it suggested is already in your library or has been shown. Try a different angle."
          : "Couldn't find verified matches for that. Try describing the vibe a little differently.",
      });
    }

    return res.status(200).json({
      success: true,
      movies: movies.slice(0, 5),
      source: groundingProvider(),
      trace: report,
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
