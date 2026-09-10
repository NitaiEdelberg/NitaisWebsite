// Groq chat call with a model fallback.
//
// Groq retires free-tier models (llama-3.3-70b-versatile went on 2026-06-17)
// and the retirement only surfaces as a 404 model_not_found on the next call,
// so one stale id silently kills every AI feature. Try the configured model
// first, then the known-live ones, so a leftover GROQ_MODEL env var on the
// host can't take the site down on its own.

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const modelCandidates = (configured = process.env.GROQ_MODEL) =>
  [configured, "openai/gpt-oss-120b", "llama-3.1-8b-instant"].filter(
    (m, i, all) => m && all.indexOf(m) === i
  );

// True when the failure means "this model id is gone", not a real API error.
export function modelIsGone(status, payload) {
  if (status !== 404 && status !== 400) return false;
  const msg = JSON.stringify(payload || "").toLowerCase();
  return (
    msg.includes("model_not_found") ||
    msg.includes("does not exist") ||
    msg.includes("decommissioned")
  );
}

// The first model that answered, remembered so later calls skip the dead ids
// instead of paying a failed round trip each time.
let workingModel = null;

export const _resetWorkingModel = () => {
  workingModel = null;
};

export async function groqChat(body, { fetchImpl = fetch, apiKey = process.env.GROQ_API_KEY } = {}) {
  let lastError = null;

  for (const model of workingModel ? [workingModel] : modelCandidates()) {
    const response = await fetchImpl(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...body, model }),
    });

    const payload = await response.json();
    if (response.ok && payload.choices?.length) {
      workingModel = model;
      return payload;
    }

    lastError = new Error("AI API error");
    lastError.details = payload;
    lastError.status = response.status || 500;
    lastError.model = model;
    if (!modelIsGone(response.status, payload)) throw lastError;
  }

  throw lastError;
}
