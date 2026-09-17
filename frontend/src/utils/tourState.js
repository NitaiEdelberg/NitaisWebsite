// Whether the introduction has been seen, kept apart from the component that
// shows it so the component file exports only a component — which is what the
// fast-refresh rule is asking for, and which also makes this testable on its
// own.

const SEEN_KEY = "movie-tour-dismissed";

export function shouldShowTour(hasMovies) {
  // Somebody with films has evidently worked out what this is.
  if (hasMovies) return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    // Private window: showing it again is better than crashing.
    return true;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to remember it with */
  }
}
