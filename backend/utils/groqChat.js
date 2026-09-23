// Groq chat call with a model fallback.
//
// The fallback list is verified against the live API, not guessed:
// llama-3.1-8b-instant returns 404 on this account, which would have made it a
// dead entry in a chain whose entire job is to have none. gpt-oss-20b answers,
// and Groq meters tokens per model per day, so when the big model's daily
// budget is spent the small one keeps recommendations working.
//
// Groq retires free-tier models (llama-3.3-70b-versatile went on 2026-06-17)
// and the retirement only surfaces as a 404 model_not_found on the next call,
// so one stale id silently kills every AI feature. Try the configured model
// first, then the known-live ones, so a leftover GROQ_MODEL env var on the
// host can't take the site down on its own.

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq's free tier meters tokens per minute AND per day, per model. Both
// refusals arrive as a 429; only one of them clears in seconds.
const MAX_ATTEMPTS = Number(process.env.GROQ_MAX_ATTEMPTS || 3);
// Groq states the wait it wants ("try again in 47s"). Honouring that is right
// for a batch job and wrong here, where somebody is watching a spinner.
const MAX_RETRY_WAIT_MS = Number(process.env.GROQ_MAX_RETRY_WAIT_MS || 6000);
const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 20000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// True when the refusal is "this model's budget is spent for today". It cannot
// clear in seconds whatever the retry hint says, so the only useful move is the
// next model, which has its own daily budget.
export function isDailyCap(status, payload) {
  if (status !== 429) return false;
  const msg = JSON.stringify(payload || "").toLowerCase();
  return msg.includes("per day") || msg.includes("tpd");
}

// Seconds the upstream asked us to wait, if it said.
export function retryAfterMs(response, payload) {
  const header = response?.headers?.get?.("retry-after");
  if (header && !Number.isNaN(Number(header))) return Number(header) * 1000;
  const found = JSON.stringify(payload || "").match(/try again in ([\d.]+)\s*s/i);
  return found ? Number(found[1]) * 1000 : null;
}

export const modelCandidates = (configured = process.env.GROQ_MODEL) =>
  [configured, "openai/gpt-oss-120b", "openai/gpt-oss-20b"].filter(
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

// Groq expects a schema inside response_format, not as a top-level field, and
// silently rejects the whole request with a 400 if one appears there. Pulled
// out and translated here so callers can pass `schema` and not know that.
//
// Schema-constrained decoding also fails in a second way worth handling
// separately: Groq implements it through its tool-calling path, and the model
// sometimes answers with a tool call instead of the JSON, which Groq rejects as
// tool_use_failed. That is a bad roll, not a capability — drop the schema for
// THIS request and try again rather than giving up on schemas everywhere.
function withSchema(body) {
  const { schema, ...rest } = body || {};
  if (!schema) return { request: rest, hadSchema: false };
  return {
    request: {
      ...rest,
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", schema, strict: false },
      },
    },
    hadSchema: true,
  };
}

// Every way Groq says "the schema is why this failed".
//
// Two different failures wear the same 400, and both are ours to retry rather
// than the upstream's to fix:
//
//   tool_use_failed     — schema decoding runs through the tool-calling path,
//                         and the model answered with a tool call.
//   json_validate_failed — a non-strict schema is validated AFTER generation,
//                         so a model that reasons its way to slightly the
//                         wrong shape (a year as "1995" rather than 1995) is
//                         rejected wholesale, with what it generated in
//                         `failed_generation`.
//
// The second one cost a production outage: its code names neither "json_schema"
// nor "tool_use_failed", so it fell past this check, and a 400 is not transient,
// so it was thrown on the spot. Seven of twelve ordinary requests died there —
// and every one of them was answerable, because parseRecommendation coerces
// exactly the sloppiness the validator refused.
function schemaWasRejected(status, payload) {
  if (status !== 400) return false;
  const msg = JSON.stringify(payload || "").toLowerCase();
  return (
    msg.includes("json_schema") ||
    msg.includes("response_format") ||
    msg.includes("tool_use_failed") ||
    msg.includes("called a tool") ||
    msg.includes("json_validate_failed") ||
    msg.includes("failed_generation") ||
    msg.includes("does not match the expected schema")
  );
}

// The generation Groq rejected, when it is usable anyway.
//
// A schema validated after the fact rejects the whole response over one field,
// and hands back what the model wrote in `failed_generation`. That text is
// almost always fine for our purposes — a year as "1995" rather than 1995, a
// missing "why" on one row of eight — because parseRecommendation coerces and
// drops per row rather than per response. Re-asking would spend another three
// seconds and another few hundred tokens of a daily budget to get back
// something we are already holding.
//
// The bar is only "is it JSON": this client has no idea what a good answer
// looks like, and the caller already treats model output as untrusted input.
// Anything that does not parse falls through to the retry below.
export function salvageFailedGeneration(payload) {
  const raw = payload?.error?.failed_generation;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    JSON.parse(raw);
  } catch {
    return null; // truncated or prose: let the retry earn a clean answer
  }
  return { choices: [{ message: { content: raw }, finish_reason: "stop" }] };
}

export async function groqChat(body, { fetchImpl = fetch, apiKey = process.env.GROQ_API_KEY } = {}) {
  let lastError = null;
  const trace = { calls: [], models: [] };
  // Local to this call, so one bad roll does not disable schemas globally.
  let { request: payloadBody, hadSchema } = withSchema(body);

  // The remembered model goes FIRST, not INSTEAD: a model that answered all day
  // is exactly the one that hits its daily cap mid-request, and the chain
  // behind it has to still be there when it does.
  const candidates = workingModel
    ? [workingModel, ...modelCandidates().filter((m) => m !== workingModel)]
    : modelCandidates();

  for (const model of candidates) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const started = Date.now();
      let response;
      let payload;

      try {
        response = await fetchImpl(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ ...payloadBody, model }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        payload = await response.json();
      } catch (err) {
        trace.calls.push({ model, ms: Date.now() - started, status: 0 });
        lastError = new Error("AI API unreachable");
        lastError.status = 503;
        lastError.details = { message: err.message };
        break; // next model rather than retrying a dead socket
      }

      trace.calls.push({
        model,
        ms: Date.now() - started,
        status: response.status,
        tokens: payload?.usage?.total_tokens,
      });

      if (response.ok && payload.choices?.length) {
        workingModel = model;
        trace.models.push(model);
        return { ...payload, trace };
      }

      lastError = new Error("AI API error");
      lastError.details = payload;
      lastError.status = response.status || 500;
      lastError.model = model;

      // Our request was wrong, not the upstream: ask for less and try again.
      if (hadSchema && schemaWasRejected(response.status, payload)) {
        // ...unless the rejected answer is sitting right there in the error.
        const salvaged = salvageFailedGeneration(payload);
        if (salvaged) {
          workingModel = model;
          trace.models.push(model);
          trace.salvaged = true;
          return { ...salvaged, trace };
        }
        ({ request: payloadBody } = withSchema({ ...body, schema: undefined }));
        hadSchema = false;
        continue;
      }

      if (modelIsGone(response.status, payload) || isDailyCap(response.status, payload)) {
        if (workingModel === model) workingModel = null;
        break; // this model cannot serve; try the next
      }

      const transient = response.status === 429 || response.status >= 500;
      if (!transient) throw lastError; // a bad key is still bad on attempt three

      const asked = retryAfterMs(response, payload);
      if (asked && asked > MAX_RETRY_WAIT_MS) break; // longer than a person waits
      if (attempt < MAX_ATTEMPTS) {
        const backoff = asked || 400 * 2 ** (attempt - 1);
        await sleep(Math.min(backoff, MAX_RETRY_WAIT_MS) * (0.75 + Math.random() * 0.5));
      }
    }
  }

  throw lastError;
}
