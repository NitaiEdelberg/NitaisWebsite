// A small TTL cache for facts about films.
//
// What is cached: the answer to "is "Heat" (1995) a real film, and what is it
// about". That is public, identical for everyone, changes approximately never,
// and costs a network round trip to Wikipedia or TMDb every time somebody asks
// for a recommendation containing a popular title.
//
// What is NOT cached, deliberately: recommendations. They are shaped by one
// person's library, their stated preferences and what they have already been
// shown, so two requests with the same words are not the same request. Caching
// them would mean building a key out of somebody's private taste profile — and
// the first key collision would hand one user another's personalised results.
// The saving is not worth that risk in a system where the expensive call is
// already only a few seconds.
//
// In-process rather than Redis: one instance serves this app, the cache is a
// convenience rather than a correctness requirement, and an empty cache after a
// restart costs one extra lookup. Adding an infrastructure dependency to save
// that would be the wrong trade for this project.

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // a day; film facts do not move
const DEFAULT_MAX = 500;

export class TtlCache {
  constructor({ ttlMs = DEFAULT_TTL_MS, max = DEFAULT_MAX, clock = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.clock = clock;
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (this.clock() - entry.storedAt > this.ttlMs) {
      this.entries.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Touch: Map preserves insertion order, so re-inserting makes this the
    // newest entry and the eviction below drops what nobody asks for.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { storedAt: this.clock(), value });
    while (this.entries.size > this.max) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  get size() {
    return this.entries.size;
  }

  stats() {
    const looked = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.entries.size,
      hit_rate: looked ? Number((this.hits / looked).toFixed(2)) : 0,
    };
  }

  clear() {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Film facts, shared by everyone, keyed by title and year.
export const movieFactCache = new TtlCache();

export const movieKey = (title, year) =>
  `${String(title || "").toLowerCase().trim()}::${year || ""}`;
