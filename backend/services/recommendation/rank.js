// Ordering, and making sure the five shown are not the same film five times.
//
// A verified list is not a good list. The model tends to answer a mood with one
// idea explored repeatedly — three films by the same director, four from the
// same five years — and a person reading five near-identical suggestions
// concludes the feature does not work, even though every row is real and
// relevant.
//
// So ranking has two halves. A score, which says how well a film fits, and a
// diversity pass, which stops the top of the list collapsing into one note.

// How much each signal is worth. Small, explicit, and easy to argue with —
// which is the point of having them in one place.
const WEIGHTS = {
  explained: 1.5,   // the model said why it fits this request
  enriched: 1.0,    // verification found a real description, not just a title
  hasPoster: 0.5,   // it will look like a real product in the grid
  ratingBonus: 1.0, // scaled by the film's own rating where one exists
  positionDecay: 0.25, // the model's own ordering carries a little information
};

export function scoreMovie(movie, index) {
  let score = 0;
  if (movie.why && movie.why.length > 10) score += WEIGHTS.explained;
  if (movie.overview && movie.overview.length > 40) score += WEIGHTS.enriched;
  if (movie.poster) score += WEIGHTS.hasPoster;
  if (typeof movie.rating === "number") {
    score += (Math.min(10, Math.max(0, movie.rating)) / 10) * WEIGHTS.ratingBonus;
  }
  // The model's ordering is weak evidence, not noise: it put its best guess
  // first. Worth a little, and never enough to override a real signal.
  score -= index * WEIGHTS.positionDecay;
  return score;
}

const decadeOf = (year) => (year ? Math.floor(year / 10) * 10 : null);

/**
 * Pick `limit` films, best first, refusing to stack one decade.
 *
 * Greedy rather than clever: take the highest-scoring film that does not
 * repeat a decade already taken twice, and if that rule would leave the list
 * short, fill from what is left. A list of four perfect films is worse than a
 * list of five good ones.
 */
export function rankAndDiversify(movies, { limit = 5, maxPerDecade = 2 } = {}) {
  const scored = movies
    .map((movie, index) => ({ ...movie, _score: scoreMovie(movie, index) }))
    .sort((a, b) => b._score - a._score);

  const chosen = [];
  const perDecade = new Map();

  for (const movie of scored) {
    if (chosen.length >= limit) break;
    const decade = decadeOf(movie.year);
    const used = decade ? perDecade.get(decade) || 0 : 0;
    if (decade && used >= maxPerDecade) continue;
    chosen.push(movie);
    if (decade) perDecade.set(decade, used + 1);
  }

  // Backfill: diversity is a preference, not a reason to return three films.
  if (chosen.length < limit) {
    for (const movie of scored) {
      if (chosen.length >= limit) break;
      if (!chosen.includes(movie)) chosen.push(movie);
    }
  }

  return chosen.map(({ _score, ...movie }) => movie);
}
