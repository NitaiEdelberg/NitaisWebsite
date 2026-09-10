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

test("real API errors are not retried away", async () => {
  _resetWorkingModel();
  delete process.env.GROQ_MODEL;
  const tried = [];
  const fetchImpl = async (_url, opts) => {
    tried.push(JSON.parse(opts.body).model);
    return { ok: false, status: 429, json: async () => ({ error: { message: "rate limit" } }) };
  };
  await assert.rejects(
    () => groqChat({ messages: [] }, { fetchImpl, apiKey: "k" }),
    (err) => err.status === 429
  );
  assert.equal(tried.length, 1, "a rate limit must not burn through the fallback list");
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
    "llama-3.1-8b-instant",
  ]);
  assert.equal(modelCandidates(undefined)[0], "openai/gpt-oss-120b");
});
