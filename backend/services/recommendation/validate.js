// The model's output, treated as input.
//
// Constrained decoding makes a malformed reply unlikely, not impossible: the
// provider can fall back to plain JSON mode, a model can return the right shape
// with the wrong types, and "8 films" can come back as nine, or as one with a
// title of 400 characters. None of that should reach a user or a database.
//
// So the boundary is here: parse, check the shape, coerce what is coercible,
// drop what is not, and report what was dropped rather than failing the whole
// request over one bad row.

const MAX_MOVIES = 12;
const MAX_TITLE = 120;
const MAX_WHY = 200;
const MAX_REPLY = 400;

// Films do not predate cinema and are not announced a decade out.
const EARLIEST_YEAR = 1888;
const LATEST_YEAR = new Date().getFullYear() + 2;

export function parseRecommendation(raw) {
  const problems = [];

  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, problems: ["the model did not return JSON"], reply: "", movies: [] };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, problems: ["the model returned a non-object"], reply: "", movies: [] };
  }

  const reply = typeof data.reply === "string" ? data.reply.trim().slice(0, MAX_REPLY) : "";
  if (!reply) problems.push("no reply text");

  const rawMovies = Array.isArray(data.movies)
    ? data.movies
    : Array.isArray(data.results)
      ? data.results
      : [];
  if (!Array.isArray(data.movies)) problems.push("movies was not an array");

  const movies = [];
  const seen = new Set();

  for (const item of rawMovies.slice(0, MAX_MOVIES)) {
    if (!item || typeof item !== "object") {
      problems.push("dropped a non-object entry");
      continue;
    }
    const title = String(item.title || "").trim().slice(0, MAX_TITLE);
    if (!title) {
      problems.push("dropped an entry with no title");
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) {
      // The model listing the same film twice is a real failure mode, and one
      // the user would notice immediately.
      problems.push(`dropped a duplicate: ${title}`);
      continue;
    }
    seen.add(key);

    const year = Number.parseInt(item.year, 10);
    const validYear = Number.isInteger(year) && year >= EARLIEST_YEAR && year <= LATEST_YEAR;
    if (!validYear && item.year !== undefined) problems.push(`implausible year for ${title}`);

    movies.push({
      title,
      // A missing or absurd year is survivable: verification searches by title
      // and returns the real year. A wrong year passed through as fact is not.
      year: validYear ? year : null,
      why: String(item.why || "").trim().slice(0, MAX_WHY),
    });
  }

  if (!movies.length) problems.push("no usable films in the reply");

  return { ok: movies.length > 0, problems, reply, movies };
}
