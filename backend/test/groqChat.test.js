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
