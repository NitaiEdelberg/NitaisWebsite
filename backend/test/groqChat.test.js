import test from "node:test";
import assert from "node:assert/strict";

import { groqChat, modelIsGone, modelCandidates, _resetWorkingModel } from "../utils/groqChat.js";

const ok = () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: '{"movies":[]}' } }] }),
});

const retired = () => ({
  ok: false,
  status: 404,
  json: async () => ({
    error: {
      message: "The model `x` does not exist or you do not have access to it.",
      code: "model_not_found",
    },
  }),
});

// Every id but openai/gpt-oss-120b is retired; records what was tried.
const fakeGroq = (tried) => async (_url, opts) => {
  const model = JSON.parse(opts.body).model;
  tried.push(model);
  return model === "openai/gpt-oss-120b" ? ok() : retired();
};

test("a retired model falls through to a live one", async () => {
  _resetWorkingModel();
  process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
  const tried = [];
  const data = await groqChat({ messages: [] }, { fetchImpl: fakeGroq(tried), apiKey: "k" });
  assert.ok(data.choices.length);
  assert.deepEqual(tried, ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]);
});

test("the model that worked is remembered", async () => {
  _resetWorkingModel();
  process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
  const tried = [];
  const fetchImpl = fakeGroq(tried);
  await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  assert.deepEqual(tried, [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-120b",
  ]);
});

test("an error that will not clear is not retried", async () => {
  // A bad key is still bad on the third attempt.
  _resetWorkingModel();
  delete process.env.GROQ_MODEL;
  const tried = [];
  const fetchImpl = async (_url, opts) => {
    tried.push(JSON.parse(opts.body).model);
    return { ok: false, status: 401, json: async () => ({ error: { message: "invalid api key" } }) };
  };
  await assert.rejects(
    () => groqChat({ messages: [] }, { fetchImpl, apiKey: "k" }),
    (err) => err.status === 401
  );
  assert.equal(tried.length, 1);
});

test("a per-minute rate limit is retried on the same model", async () => {
  // Being told to slow down is not a reason to abandon a working model.
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const tried = [];
  const fetchImpl = async (_url, opts) => {
    tried.push(JSON.parse(opts.body).model);
    if (tried.length > 2) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
    }
    return { ok: false, status: 429, json: async () => ({ error: { message: "rate limit reached" } }) };
  };
  const data = await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  assert.ok(data.choices.length);
  assert.deepEqual(tried, ["openai/gpt-oss-120b", "openai/gpt-oss-120b", "openai/gpt-oss-120b"]);
});

test("a daily cap skips the retries and takes the next model", async () => {
  // The refusal that took the other project down: a day's budget does not come
  // back in the 30 seconds its retry hint claims, so retrying burns the request.
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const tried = [];
  const fetchImpl = async (_url, opts) => {
    const model = JSON.parse(opts.body).model;
    tried.push(model);
    if (model === "openai/gpt-oss-120b") {
      return {
        ok: false, status: 429,
        json: async () => ({ error: { message:
          "Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): Limit 200000. Please try again in 31.9s." } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
  };
  await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  assert.deepEqual(tried, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
});

test("the remembered model keeps the chain behind it", async () => {
  // Remembering what worked is an optimisation; returning ONLY it deletes the
  // fallback at the moment the remembered model runs out of daily budget.
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  let capped = false;
  const fetchImpl = async (_url, opts) => {
    const model = JSON.parse(opts.body).model;
    if (model === "openai/gpt-oss-120b" && capped) {
      return { ok: false, status: 429,
        json: async () => ({ error: { message: "tokens per day (TPD) limit reached" } }) };
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
  };
  await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });  // remembers 120b
  capped = true;
  const data = await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  assert.ok(data.choices.length, "the chain behind the remembered model still answered");
});

test("every call is traced with its model, latency and tokens", async () => {
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: "{}" } }], usage: { total_tokens: 812 } }),
  });
  const data = await groqChat({ messages: [] }, { fetchImpl, apiKey: "k" });
  assert.equal(data.trace.calls.length, 1);
  assert.equal(data.trace.calls[0].tokens, 812);
  assert.equal(data.trace.models[0], "openai/gpt-oss-120b");
});

test("it gives up once every candidate is retired", async () => {
  _resetWorkingModel();
  delete process.env.GROQ_MODEL;
  const tried = [];
  const fetchImpl = async (_url, opts) => {
    tried.push(JSON.parse(opts.body).model);
    return retired();
  };
  await assert.rejects(() => groqChat({ messages: [] }, { fetchImpl, apiKey: "k" }));
  assert.deepEqual(tried, modelCandidates(undefined));
});

test("modelIsGone only fires on a missing model", () => {
  assert.equal(modelIsGone(404, { error: { code: "model_not_found" } }), true);
  assert.equal(modelIsGone(400, { error: { message: "model has been decommissioned" } }), true);
  assert.equal(modelIsGone(429, { error: { message: "rate limit" } }), false);
  assert.equal(modelIsGone(401, { error: { message: "invalid api key" } }), false);
  assert.equal(modelIsGone(404, { error: { message: "unknown route" } }), false);
});

test("candidates are de-duplicated and keep the configured model first", () => {
  assert.deepEqual(modelCandidates("openai/gpt-oss-120b"), [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
  ]);
  assert.equal(modelCandidates(undefined)[0], "openai/gpt-oss-120b");
});


test("a schema is translated into response_format, never sent as a raw field", async () => {
  // Groq rejects an unknown top-level field with a 400, which is how the whole
  // recommendation route broke in production while every test passed: the fake
  // chat ignored the extra field that the real API refuses.
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  let sent;
  const fetchImpl = async (_url, opts) => {
    sent = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
  };

  await groqChat(
    { messages: [], schema: { type: "object", properties: { ok: { type: "boolean" } } } },
    { fetchImpl, apiKey: "k" }
  );

  assert.equal(sent.schema, undefined, "no bare schema field reaches the API");
  assert.equal(sent.response_format.type, "json_schema");
  assert.equal(sent.response_format.json_schema.schema.type, "object");
});

test("a rejected schema is dropped and the call retried without it", async () => {
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const formats = [];
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    formats.push(body.response_format?.type);
    if (body.response_format?.type === "json_schema") {
      return {
        ok: false, status: 400,
        json: async () => ({ error: { message: "Tool choice is none, but model called a tool", code: "tool_use_failed" } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
  };

  const data = await groqChat(
    { messages: [], response_format: { type: "json_object" }, schema: { type: "object" } },
    { fetchImpl, apiKey: "k" }
  );
  assert.ok(data.choices.length);
  assert.deepEqual(formats, ["json_schema", "json_object"]);
});

// The failure that took the recommender down in production for most of a
// battery of twelve ordinary requests. Groq validates a non-strict schema
// AFTER generation, so a model that reasons its way to slightly the wrong
// shape gets a 400 with code `json_validate_failed` — a code that named
// neither "json_schema" nor "tool_use_failed", so the degradation path did not
// recognise it, and a 400 is not transient, so it was thrown on the spot.
const validatorRejected = (generation) => ({
  ok: false,
  status: 400,
  json: async () => ({
    error: {
      message: "Generated JSON does not match the expected schema. Please adjust your prompt.",
      type: "invalid_request_error",
      code: "json_validate_failed",
      failed_generation: generation,
    },
  }),
});

test("a generation the validator rejected is used when it is still JSON", async () => {
  // The whole response was thrown away over one field: a year as a string,
  // which parseRecommendation coerces. Re-asking buys nothing but latency.
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const generation = '{"reply":"Here are a few.","movies":[{"title":"Heat","year":"1995","why":"tense"}]}';
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return validatorRejected(generation);
  };

  const data = await groqChat(
    { messages: [], response_format: { type: "json_object" }, schema: { type: "object" } },
    { fetchImpl, apiKey: "k" }
  );
  assert.equal(calls, 1, "the answer was already in hand; do not ask again");
  assert.equal(data.choices[0].message.content, generation);
  assert.ok(data.trace.salvaged);
});

test("a generation too broken to parse falls back to dropping the schema", async () => {
  _resetWorkingModel();
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const formats = [];
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    formats.push(body.response_format?.type);
    if (body.response_format?.type === "json_schema") {
      // Truncated mid-object: nothing to salvage here.
      return validatorRejected('{"reply":"Here are a few.","movies":[{"title":"He');
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) };
  };

  const data = await groqChat(
    { messages: [], response_format: { type: "json_object" }, schema: { type: "object" } },
    { fetchImpl, apiKey: "k" }
  );
  assert.ok(data.choices.length, "the call should succeed without the schema");
  assert.deepEqual(formats, ["json_schema", "json_object"]);
});
