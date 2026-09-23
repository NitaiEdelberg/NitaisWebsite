// The journeys a person actually takes, over real HTTP, against the real app.
//
// The database is a real MongoDB running in memory, so schemas, indexes,
// queries and ownership rules are exercised rather than mocked — the whole
// point is to catch the mistakes that only appear when those interact. The
// model is the one thing faked: tests that call a paid API are tests that get
// deleted.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret-for-journeys";
process.env.GROQ_API_KEY = "test-key";

const { default: app } = await import("../app.js");
const { _resetRateLimits } = await import("../middleware/rateLimit.js");
const { setProviders, resetProviders } = await import("../services/providers.js");
const { movieFactCache } = await import("../utils/cache.js");

let mongo;
let server;
let base;

// Every outside dependency answers from here, so a test decides what the model
// said and whether the film database recognised it.
const fake = {
  reply: { reply: "Here are a few.", movies: [{ title: "Ronin", year: 1998, why: "Cold and professional." }] },
  verified: [{ title: "Ronin", year: 1998, poster: "", overview: "A real film about a heist.", rating: 7.5, source: "test" }],
  failModel: false,
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  // Both outside dependencies, swapped through the provider seam.
  setProviders({
    chat: async () => {
      if (fake.failModel === "detailed") {
        const e = new Error("AI API error");
        e.status = 400;
        e.details = {
          error: {
            message: "Tool choice is none, but model called a tool in organization org_01secret",
            code: "tool_use_failed",
            failed_generation: "{\"name\": \"x\"}",
          },
        };
        throw e;
      }
      if (fake.failModel) { const e = new Error("upstream down"); e.status = 503; throw e; }
      return {
        choices: [{ message: { content: JSON.stringify(fake.reply) } }],
        trace: { models: ["test-model"], calls: [{ tokens: 50 }] },
      };
    },
    verify: async (candidates) =>
      fake.verified.filter((v) => candidates.some((c) => c.title === v.title)),
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  resetProviders();
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  _resetRateLimits();
  movieFactCache.clear();
  fake.failModel = false;
  for (const name of Object.keys(mongoose.connection.collections)) {
    await mongoose.connection.collections[name].deleteMany({});
  }
});

const call = (path, options = {}) =>
  fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

async function signUp(email = "someone@example.com", password = "hunter2hunter2") {
  await call("/api/auth/register", { method: "POST", body: { email, password } });
  const res = await call("/api/auth/login", { method: "POST", body: { email, password } });
  return (await res.json()).token;
}

// ---- authentication ------------------------------------------------------

test("someone can sign up and log in", async () => {
  const token = await signUp();
  assert.ok(token && token.length > 20);
});

test("the same email cannot register twice, whatever its casing", async () => {
  await call("/api/auth/register", { method: "POST", body: { email: "a@b.com", password: "hunter2hunter2" } });
  const again = await call("/api/auth/register", { method: "POST", body: { email: "A@B.com", password: "hunter2hunter2" } });
  assert.equal(again.status, 400, "Nitai@x.com and nitai@x.com are one account");
});

test("a short password is refused with a reason", async () => {
  const res = await call("/api/auth/register", { method: "POST", body: { email: "c@d.com", password: "short" } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /between 8 and 72/);
});

test("wrong credentials say nothing about which half was wrong", async () => {
  await signUp("e@f.com");
  const res = await call("/api/auth/login", { method: "POST", body: { email: "e@f.com", password: "wrongpassword" } });
  assert.equal(res.status, 401);
  assert.match((await res.json()).message, /Invalid credentials/);
});

test("the library refuses an unauthenticated request", async () => {
  assert.equal((await call("/api/movies")).status, 401);
});

// ---- the library ---------------------------------------------------------

test("a film can be added, listed, rated and removed", async () => {
  const token = await signUp("lib@example.com");

  const created = await call("/api/movies", {
    method: "POST", token,
    body: { name: "Heat", year: 1995, image: "x", grade: 9, note: "The diner scene." },
  });
  assert.equal(created.status, 201);
  const { data: movie } = await created.json();

  const listed = await (await call("/api/movies", { token })).json();
  assert.equal(listed.data.length, 1);
  assert.equal(listed.total, 1);
  assert.equal(listed.data[0].user, undefined, "the owner id is never sent to the client");

  const updated = await call(`/api/movies/${movie._id}`, {
    method: "PUT", token, body: { grade: 10 },
  });
  assert.equal((await updated.json()).data.grade, 10);

  assert.equal((await call(`/api/movies/${movie._id}`, { method: "DELETE", token })).status, 200);
  assert.equal((await (await call("/api/movies", { token })).json()).data.length, 0);
});

test("a film with an impossible year is refused, not stored", async () => {
  const token = await signUp("year@example.com");
  const res = await call("/api/movies", {
    method: "POST", token, body: { name: "Future", year: 9999, image: "x" },
  });
  assert.equal(res.status, 400);
});

test("a request cannot assign a film to somebody else", async () => {
  const mine = await signUp("mine@example.com");
  const theirs = await signUp("theirs@example.com");
  const theirId = JSON.parse(Buffer.from(theirs.split(".")[1], "base64").toString()).userId;

  await call("/api/movies", {
    method: "POST", token: mine,
    body: { name: "Mine", year: 2000, image: "x", user: theirId },
  });

  const theirLibrary = await (await call("/api/movies", { token: theirs })).json();
  assert.equal(theirLibrary.data.length, 0, "the body's user field is ignored");
});

test("one person cannot read, edit or delete another's films", async () => {
  const mine = await signUp("owner@example.com");
  const theirs = await signUp("attacker@example.com");

  const created = await call("/api/movies", {
    method: "POST", token: mine, body: { name: "Private", year: 1999, image: "x" },
  });
  const { data: movie } = await created.json();

  assert.equal((await (await call("/api/movies", { token: theirs })).json()).data.length, 0);
  assert.equal(
    (await call(`/api/movies/${movie._id}`, { method: "PUT", token: theirs, body: { grade: 1 } })).status,
    404, "an edit of someone else's film is a 404, not a silent success");
  assert.equal(
    (await call(`/api/movies/${movie._id}`, { method: "DELETE", token: theirs })).status,
    404);

  const stillThere = await (await call("/api/movies", { token: mine })).json();
  assert.equal(stillThere.data[0].grade, undefined, "and their film is untouched");
});

test("the listing pages rather than returning everything", async () => {
  const token = await signUp("many@example.com");
  for (let i = 0; i < 5; i += 1) {
    await call("/api/movies", { method: "POST", token, body: { name: `Film ${i}`, year: 2000 + i, image: "x" } });
  }
  const page = await (await call("/api/movies?limit=2&page=1", { token })).json();
  assert.equal(page.data.length, 2);
  assert.equal(page.total, 5);
  assert.equal(page.has_more, true);
});

// ---- recommendations -----------------------------------------------------

test("a recommendation returns verified films and remembers them", async () => {
  const token = await signUp("rec@example.com");

  const res = await call("/api/ai/recommend", { method: "POST", token, body: { message: "something like Heat" } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.movies.map((m) => m.title), ["Ronin"]);
  assert.equal(body.trace.unverifiable, 0);

  const memory = await (await call("/api/ai/memory", { token })).json();
  assert.equal(memory.shown, 1, "what was offered is remembered for next time");
  assert.equal(memory.turns, 2, "and so is the exchange");
});

test("the same film is not offered twice across requests", async () => {
  const token = await signUp("repeat@example.com");
  await call("/api/ai/recommend", { method: "POST", token, body: { message: "heist films" } });

  const second = await (await call("/api/ai/recommend", {
    method: "POST", token, body: { message: "more heist films" },
  })).json();

  assert.deepEqual(second.movies, [], "Ronin was already shown, so nothing new is offered");
  assert.match(second.reply, /Nothing new/i);
});

test("a film the model invented is never shown", async () => {
  const token = await signUp("halluc@example.com");
  fake.reply = {
    reply: "Try these.",
    movies: [
      { title: "Ronin", year: 1998, why: "Real." },
      { title: "The Heist That Never Was", year: 2011, why: "Invented." },
    ],
  };

  const body = await (await call("/api/ai/recommend", {
    method: "POST", token, body: { message: "heists" },
  })).json();

  assert.deepEqual(body.movies.map((m) => m.title), ["Ronin"]);
  assert.equal(body.trace.unverifiable, 1, "and the drop is reported");
  fake.reply = { reply: "Here are a few.", movies: [{ title: "Ronin", year: 1998, why: "Cold and professional." }] };
});

test("a model outage is a 502 the person can read", async () => {
  const token = await signUp("down@example.com");
  fake.failModel = true;
  const res = await call("/api/ai/recommend", { method: "POST", token, body: { message: "anything" } });
  assert.equal(res.status, 503);
  assert.match((await res.json()).message, /unavailable|busy/i);
});

test("an empty request is refused without calling the model", async () => {
  const token = await signUp("empty@example.com");
  const res = await call("/api/ai/recommend", { method: "POST", token, body: { message: "   " } });
  assert.equal(res.status, 400);
});

test("recommendations require a login, because they spend real money", async () => {
  assert.equal((await call("/api/ai/recommend", { method: "POST", body: { message: "hi" } })).status, 401);
});

test("rejecting a film stops it coming back", async () => {
  const token = await signUp("reject@example.com");
  await call("/api/ai/reject", { method: "POST", token, body: { title: "Ronin" } });

  const body = await (await call("/api/ai/recommend", {
    method: "POST", token, body: { message: "heist films" },
  })).json();
  assert.deepEqual(body.movies, []);

  const memory = await (await call("/api/ai/memory", { token })).json();
  assert.equal(memory.rejected, 1);
});

test("someone can see and clear what the system remembers about them", async () => {
  const token = await signUp("forget@example.com");
  await call("/api/ai/recommend", { method: "POST", token, body: { message: "heist films" } });

  assert.equal((await (await call("/api/ai/memory", { token })).json()).shown, 1);
  assert.equal((await call("/api/ai/memory", { method: "DELETE", token })).status, 200);

  const after = await (await call("/api/ai/memory", { token })).json();
  assert.equal(after.shown, 0);
  assert.equal(after.turns, 0);
});

test("one person's conversation is invisible to another", async () => {
  const mine = await signUp("chat-a@example.com");
  const theirs = await signUp("chat-b@example.com");
  await call("/api/ai/recommend", { method: "POST", token: mine, body: { message: "heist films" } });

  const theirMemory = await (await call("/api/ai/memory", { token: theirs })).json();
  assert.equal(theirMemory.turns, 0);
  assert.equal(theirMemory.shown, 0);
});

test("the recommendation route is rate limited", async () => {
  const token = await signUp("flood@example.com");
  let sawLimit = false;
  for (let i = 0; i < 15; i += 1) {
    const res = await call("/api/ai/recommend", { method: "POST", token, body: { message: `ask ${i}` } });
    if (res.status === 429) { sawLimit = true; break; }
  }
  assert.ok(sawLimit, "an unbounded AI route is an unbounded bill");
});

test("an oversized body is refused before it is parsed", async () => {
  const token = await signUp("big@example.com");
  const res = await call("/api/ai/recommend", {
    method: "POST", token, body: { message: "x".repeat(200_000) },
  });
  assert.ok([413, 400].includes(res.status));
});

test("security headers are set on every response", async () => {
  const res = await call("/api/health");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.ok(res.headers.get("x-request-id"), "and every response is traceable");
});

test("an upstream failure returns its error code, and never its body", async () => {
  // Diagnosing this from the outside took two wrong guesses — a stale build and
  // a missing key — because the response said only "unavailable". The code is
  // safe to return; the body is not, since it carries the organisation id and
  // echoes the request back.
  const token = await signUp("upstream@example.com");
  const previous = fake.failModel;
  fake.failModel = "detailed";

  const res = await call("/api/ai/recommend", { method: "POST", token, body: { message: "anything" } });
  const body = await res.json();

  assert.equal(body.upstream.status, 400);
  assert.equal(body.upstream.code, "tool_use_failed");
  const serialised = JSON.stringify(body);
  assert.ok(!serialised.includes("org_"), "no organisation id reaches the client");
  assert.ok(!serialised.includes("failed_generation"), "and no echo of the request");

  fake.failModel = previous;
});
