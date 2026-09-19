// Finding films the model cannot know about.
//
// A language model's knowledge ends where its training data ends. Ask it for
// "a comedy from 2026" and it will answer — confidently, with titles that do
// not exist or films from 2004. No prompt fixes that, because the information
// is not in there to retrieve.
//
// A film database has it. TMDb can list what actually came out in a given year,
// in a given genre, sorted by how much attention it got. So a request for
// recency is a retrieval problem, not a generation problem, and this is the
// retrieval half.
//
// Without a TMDb key there is no catalogue, and the honest answer is to say
// what cannot be done rather than to guess — see constraints.explainShortfall.

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_URL = "https://api.themoviedb.org/3";
const TIMEOUT_MS = Number(process.env.TMDB_TIMEOUT_MS || 6000);

// TMDb's genre ids, for the genres a person actually asks for by name. Hard-
// coded rather than fetched: the list changes about never, and a lookup call
// per request to save a dozen lines is a bad trade.
const GENRES = {
  comedy: 35, action: 28, adventure: 12, animation: 16, crime: 80,
  documentary: 99, drama: 18, family: 10751, fantasy: 14, history: 36,
  horror: 27, music: 10402, mystery: 9648, romance: 10749,
  "science fiction": 878, "sci-fi": 878, thriller: 53, war: 10752, western: 37,
};

export const catalogueAvailable = () => Boolean(TMDB_KEY);

/** The genre a request names, if it names one. */
export function detectGenre(message) {
  const text = String(message || "").toLowerCase();
  for (const [name, id] of Object.entries(GENRES)) {
    if (text.includes(name)) return { name, id };
  }
  return null;
}

async function tmdb(path, params) {
  const query = new URLSearchParams({ api_key: TMDB_KEY, ...params });
  const response = await fetch(`${TMDB_URL}${path}?${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`TMDb ${response.status}`);
  return response.json();
}

/**
 * Films that actually exist in a year window, most talked-about first.
 *
 * `sort_by=popularity.desc` rather than rating: a film released this year has
 * few enough votes that its average is noise, and "what people are watching"
 * is closer to what somebody asking for something new means.
 */
export async function discover({ constraints, message, limit = 10 }) {
  if (!catalogueAvailable()) return { movies: [], reason: "no catalogue configured" };

  const genre = detectGenre(message);
  const params = {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "10", // enough that it is a real release, not an upload
    language: "en-US",
  };
  if (genre) params.with_genres = String(genre.id);
  if (constraints?.year?.min) params["primary_release_date.gte"] = `${constraints.year.min}-01-01`;
  if (constraints?.year?.max) params["primary_release_date.lte"] = `${constraints.year.max}-12-31`;

  try {
    const data = await tmdb("/discover/movie", params);
    const movies = (data.results || []).slice(0, limit).map((item) => ({
      title: item.title,
      year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
      overview: item.overview || "",
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "",
      rating: typeof item.vote_average === "number" ? item.vote_average : null,
      source: "tmdb",
      // Marked so the pipeline knows these came from a catalogue and are
      // already verified — re-verifying a TMDb result against TMDb is a round
      // trip to be told what it just said.
      verified: true,
    }));
    return { movies, genre: genre?.name || null, reason: null };
  } catch (error) {
    // A catalogue outage is not a reason to fall back to guessing: the caller
    // says what could not be done instead.
    console.warn("catalogue lookup failed:", error.message);
    return { movies: [], reason: `catalogue unavailable (${error.message})` };
  }
}
