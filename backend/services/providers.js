// The two outside things this app depends on, behind one seam.
//
// `chat` is whichever LLM answers, and `verify` is whichever film database
// decides what is real. Both are referenced through here rather than imported
// directly by the pipeline, for two reasons that are the same reason:
//
//   - swapping Groq for another provider, or Wikipedia for TMDb, should be a
//     change in one file rather than a search across the services;
//   - tests can substitute both and run the whole pipeline over real HTTP
//     without a key, a bill, or a network.
//
// ES module exports are immutable, so a test cannot reassign an imported
// function. Rather than reach for a mocking library that rewrites the loader,
// the indirection is explicit and small.

import { groqChat } from "../utils/groqChat.js";
import { verifyCandidates } from "../utils/movieLookup.js";

const defaults = { chat: groqChat, verify: verifyCandidates };
let current = { ...defaults };

export const providers = {
  chat: (...args) => current.chat(...args),
  verify: (...args) => current.verify(...args),
};

/** Swap an implementation. Used by tests, and by any future provider change. */
export function setProviders(overrides = {}) {
  current = { ...current, ...overrides };
}

export function resetProviders() {
  current = { ...defaults };
}
