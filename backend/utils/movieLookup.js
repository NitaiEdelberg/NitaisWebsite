// Grounding layer for AI recommendations.
//
// The LLM is good at understanding a *mood* ("a cozy heist movie for a rainy
// night") but it will happily invent films that don't exist or get the year
// wrong. So we never trust the model's movie facts directly — we take its
// candidate titles and look each one up in a real source, keeping only the
// ones that actually exist and replacing the model's text with the source's
// canonical title / year / poster / overview.
//
// Two providers, in order:
//   1. TMDb      — best data + real posters, needs a free TMDB_API_KEY.
//   2. Wikipedia — keyless fallback so the feature works with zero setup
//                  (verifies the film exists; poster falls back to a generated
//                  one on the client).
//
// Both return the same normalized shape (or null if it can't be verified):
//   { title, year, poster, overview, rating, genre, source, url }

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const UA = "NitaisMovieWatchlist/1.0 (portfolio project)";

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...opts.headers }, ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Normalize a title for comparison: drop "(2010 film)" style parens, lowercase,
// strip punctuation, collapse whitespace.
function normTitle(t = "") {
  return String(t)
    .replace(/\((?:[^)]*\bfilm\b[^)]*|\d{4})\)/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿ ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Guard against the search engine returning an unrelated film for an invented
// title: require meaningful token overlap between what we asked for and what
// came back (or one being a substring of the other).
function titlesMatch(query, found) {
  const a = normTitle(query);
  const b = normTitle(found);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const at = new Set(a.split(" ").filter((w) => w.length > 1));
  const bt = new Set(b.split(" ").filter((w) => w.length > 1));
  if (!at.size) return false;
  let hit = 0;
  for (const w of at) if (bt.has(w)) hit++;
  return hit / at.size >= 0.6; // most of the requested words are present
}

// --- TMDb -------------------------------------------------------------------
async function verifyWithTmdb(title, year) {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: title,
    include_adult: "false",
  });
  if (year) params.set("year", String(year));

  const data = await fetchJson(
    `https://api.themoviedb.org/3/search/movie?${params.toString()}`
  );
  const hit = data.results?.[0];
  if (!hit || !titlesMatch(title, hit.title)) return null;

  return {
    title: hit.title,
    year: hit.release_date ? Number(hit.release_date.slice(0, 4)) : year || null,
    poster: hit.poster_path ? `${TMDB_IMG}${hit.poster_path}` : "",
    overview: hit.overview || "",
    rating: hit.vote_average ? Math.round(hit.vote_average * 10) / 10 : null,
    genre: "",
    source: "tmdb",
    url: `https://www.themoviedb.org/movie/${hit.id}`,
  };
}

// --- Wikipedia (keyless) ----------------------------------------------------
async function verifyWithWikipedia(title, year) {
  const search = `${title}${year ? " " + year : ""} film`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: search,
    gsrlimit: "1",
    prop: "pageimages|extracts|description",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail",
    pithumbsize: "400",
    redirects: "1",
    origin: "*",
  });
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`
  );
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page?.title) return null;

  const desc = page.description || "";
  const extract = page.extract || "";
  const isFilm = /\bfilm\b/i.test(desc) || /\bfilm\b/i.test(extract);
  if (!isFilm) return null;
  if (!titlesMatch(title, page.title)) return null;

  // Pull the year out of "2010 film" / "is a 2010 ... film".
  const yearMatch = (desc.match(/(\d{4})\s+film/i) || extract.match(/\b(19|20)\d{2}\b/)) || [];
  const foundYear = yearMatch[1] ? Number(yearMatch[0].match(/\d{4}/)[0]) : year || null;

  return {
    title: page.title.replace(/\s*\((?:\d{4}\s+)?film\)$/i, "").trim(),
    year: foundYear,
    poster: page.thumbnail?.source || "", // often absent → client shows a generated poster
    overview: extract.slice(0, 300),
    rating: null,
    genre: "",
    source: "wikipedia",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
  };
}

// Verify a single candidate title against whichever provider is available.
export async function verifyMovie(title, year) {
  if (!title) return null;
  try {
    if (TMDB_KEY) {
      const viaTmdb = await verifyWithTmdb(title, year);
      if (viaTmdb) return viaTmdb;
    }
    return await verifyWithWikipedia(title, year);
  } catch (err) {
    console.error(`movie lookup failed for "${title}":`, err.message);
    return null;
  }
}

// Verify a list of {title, year} candidates in parallel, drop the ones that
// can't be confirmed, and de-duplicate by canonical title.
export async function verifyCandidates(candidates = []) {
  const verified = await Promise.all(
    candidates.map((c) => verifyMovie(c.title, c.year))
  );
  const seen = new Set();
  const out = [];
  for (const m of verified) {
    if (!m) continue;
    const key = `${normTitle(m.title)}|${m.year || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export const groundingProvider = () => (TMDB_KEY ? "tmdb" : "wikipedia");
