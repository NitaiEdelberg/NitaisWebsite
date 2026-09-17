// What the suggester is allowed to remember between visits.
//
// The exclusion list used to live in React state, so it emptied on every
// reload and the same five films came back for the same prompt on Monday and
// on Tuesday. The server already excludes everything in your library; this
// covers the rest — what you were shown and did not save, and what you
// explicitly turned down.
//
// Deliberately in localStorage rather than on the server: it is a convenience,
// it belongs to this browser, and it is not worth a table or a migration. Every
// read and write is wrapped, because a private window throws on access rather
// than returning nothing.

const SHOWN_KEY = "ai-suggest-shown";
const REJECTED_KEY = "ai-suggest-rejected";

// Enough to stop repeats for weeks, small enough that the prompt stays cheap:
// every remembered title is tokens in every request.
const MAX_SHOWN = 60;
const MAX_REJECTED = 40;

function read(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function write(key, titles, cap) {
  try {
    // Newest first, so the cap drops the oldest rather than the most relevant.
    localStorage.setItem(key, JSON.stringify(titles.slice(0, cap)));
  } catch {
    // Private mode, or storage full. The feature still works, it just forgets.
  }
}

export const shownTitles = () => read(SHOWN_KEY);
export const rejectedTitles = () => read(REJECTED_KEY);

export function rememberShown(titles) {
  const merged = [...new Set([...(titles || []), ...read(SHOWN_KEY)])];
  write(SHOWN_KEY, merged, MAX_SHOWN);
}

export function rememberRejected(title) {
  if (!title) return;
  write(REJECTED_KEY, [...new Set([title, ...read(REJECTED_KEY)])], MAX_REJECTED);
}

/** Everything the next request should avoid: shown plus explicitly rejected. */
export const avoidList = () => [...new Set([...read(REJECTED_KEY), ...read(SHOWN_KEY)])];

export function forgetEverything() {
  try {
    localStorage.removeItem(SHOWN_KEY);
    localStorage.removeItem(REJECTED_KEY);
  } catch {
    /* nothing to forget */
  }
}
