// The recommendation endpoints, in one place.
//
// Fetch calls scattered through components are how error handling drifts: one
// place checks status, another reads `.message`, a third assumes success. These
// throw a human-readable Error or return parsed data, and every caller handles
// exactly one failure shape.

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
    });
  } catch {
    // A network failure, a sleeping server, or a tab that lost connectivity —
    // indistinguishable from here, and the same advice for all three.
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  if (response.status === 401) {
    throw new Error("Your session expired. Log in again to keep chatting.");
  }
  if (response.status === 429) {
    const seconds = response.headers.get("Retry-After") || "a moment";
    throw new Error(`That's a lot of asking — try again in ${seconds} seconds.`);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server sent something unreadable. Try again?");
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || "That didn't work. Try again?");
  }
  return data;
}

export const askRecommender = (message) =>
  request("/api/ai/recommend", { method: "POST", body: JSON.stringify({ message }) });

export const rejectSuggestion = (movie) =>
  request("/api/ai/reject", {
    method: "POST",
    body: JSON.stringify({ title: movie.title, movie }),
  });

export const getMemory = () => request("/api/ai/memory");

export const forgetMemory = () => request("/api/ai/memory", { method: "DELETE" });
