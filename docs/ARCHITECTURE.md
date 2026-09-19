# Architecture

One page on how a request works, and then the decisions behind it with what
each one cost.

## The shape of it

```
React (Vite)                     Express                      outside
─────────────                    ───────                      ───────
RecommendChat  ──POST /api/ai/recommend──▶  ai.controller
                                                │
                                                ▼
                                     services/recommendation
                                                │
   ┌────────────────────────────────────────────┼──────────────────────┐
   │  context ──▶ prompts ──▶ [LLM] ──▶ validate ──▶ [film DB] ──▶      │
   │      ▲                                                 filter ──▶ │
   │   memory                                               rank       │
   │  conversation ◀──────────── remember ◀────────────────────────────┘
   └───────────────────────────────────────────────────────────────────┘
                                                │
MovieCard  ◀────── JSON: reply, movies, trace ──┘

MongoDB: users · movies · chatsessions
```

Every stage is a module with one job. `services/recommendation/index.js` is the
only file that knows the order, which is what makes "which stage went wrong" a
question with an answer.

## A request, end to end

1. **Authenticate.** `authMiddleware` turns the bearer token into `req.userId`.
   Every query below is scoped to that id and never to anything in the body.
2. **Rate limit.** 12 recommendations per user per minute. This route spends
   money.
3. **Read what the pipeline needs.** The conversation session and the user's
   library, in parallel, in the controller — so the pipeline itself touches no
   database and can be tested without one.
4. **Build context** (`context.js`). The request, the last 6 turns, one summary
   standing in for everything older, active preferences, up to 8 highly-rated
   films as calibration, and up to 40 titles to avoid.
5. **Build the prompt** (`prompts.js`). Versioned, with user text wrapped in a
   delimited block it cannot close.
6. **Ask the model** (`utils/groqChat.js`). Schema-constrained where supported,
   with a model fallback chain, bounded retries, and a per-call timeout.
7. **Validate** (`validate.js`). Parse, check the shape, coerce what is
   coercible, drop duplicates and implausible years, report what was dropped.
8. **Verify** (`utils/movieLookup.js`). Each title against TMDb, or Wikipedia
   when there is no TMDb key. Anything unverifiable is discarded here.
9. **Filter.** Remove anything owned, already shown, or rejected.
10. **Rank** (`rank.js`). Score by explanation, enrichment, poster and rating;
    then cap at two per decade while a full list is still possible.
11. **Respond**, with a trace: proposed, verified, unverifiable, blocked, shown.
12. **Remember** (`conversation.js`, `memory.js`). Append the turn, record what
    was shown, extract durable preferences, compact if the history is long.
    Failure here is logged and swallowed — memory must not cost the answer.

## Context and memory

Three stores, with different lifetimes and different levels of trust.

| | What | Bound | Lifetime |
|---|---|---|---|
| Short-term | the last 6 turns, verbatim | 6 turns | until compaction |
| Compacted | one summary of everything older | 1,500 chars | until cleared |
| Long-term | structured preferences | 40, 12 used per request | until cleared |
| Negative | titles shown / rejected | 120 / 60 | until cleared |

**Why not send the whole conversation.** Context is a budget, not a container.
Every token spent on a pleasantry from last Tuesday is paid for on every request
forever, and long before it becomes expensive it becomes counterproductive — the
model weighs a stale request as heavily as the current one.

**How compaction works.** Above 12 turns, everything but the last 6 is folded
into a running summary. Only the departing turns are summarised, together with
the previous summary — not the whole history — so compaction costs the same at
turn 10 and turn 1,000. If the model is unavailable, the old turns are dropped
and the summary says so, because an unbounded array is a worse failure than a
gap in the notes.

**Explicit versus inferred.** "I hate horror" is a constraint. "Has picked three
nineties thrillers" is a hint. They are stored in the same shape with a `source`
field, and the difference is enforced:

- an inference must recur **three times** before it influences a recommendation;
- an inference never overwrites something the person said;
- an explicit statement immediately overrides an inference about the same thing;
- a reversal flips the sentiment rather than leaving two contradictory beliefs.

Everything the model proposes as a preference is checked against a closed
vocabulary (`genre`, `tone`, `era`, `language`, `theme`, `avoid` ×
`likes`/`dislikes`) before storage. The model proposes; the application decides.

`GET /api/ai/memory` returns what is believed and why. `DELETE` forgets it.
Memory that cannot be inspected cannot be trusted or corrected.

## Constraints, and the model's knowledge cutoff

Someone asked for *"a new comedy film from 2026, similar to The Dictator"* and
got films from 1999, 2004 and 2010. Three failures stacked, only one of them the
model's:

1. Nothing extracted "2026" as a requirement — it was words in a prompt.
2. Nothing enforced it afterwards, so three films from the wrong century passed
   verification and ranking.
3. The prompt asked for *"at least three decades"*, which is right for "something
   funny" and exactly wrong for "something from 2026".

Underneath all three is the thing no prompt fixes: **a model cannot know about
films released after its training data ends.** Asking for 2026 releases does not
produce 2026 releases, it produces confident guesses.

So:

- `constraints.js` reads year windows deterministically — "from 2026", "the 90s",
  "before 2000", "since 2015", "the last 3 years", "new", "classic". Patterns run
  most specific first, so `before 2000` is not eaten by the bare year inside it.
- The constraint is **enforced in code after verification**, because the model's
  claimed year is a guess and verification replaces it with the real one.
- The prompt is told the requirement overrides the spread rule.
- A request for years past `MODEL_KNOWLEDGE_YEAR` is routed to **TMDb discover**
  (`catalogue.js`) when a key is configured — recency is a retrieval problem, not
  a generation one.
- With no catalogue key, the system **says so**: "what I know about films stops
  around 2025, and anything I offered for this year would be a guess dressed up
  as a fact." Returning something from 1999 and hoping nobody checks is the
  failure being prevented.

## Caching

| Cached | Key | TTL | Why |
|---|---|---|---|
| Film verification | `title::year` | 24h | Public, identical for everyone, effectively immutable |
| Negative results | same | 24h | Invented titles repeat; re-asking about a film that does not exist is the most wasteful lookup made |

**Not cached: recommendations.** The key would have to include one person's
library, preferences and history — and the first key collision would serve one
user another's personalised results. The expensive call is a few seconds; that
is not worth the risk.

**Not cached: network failures.** A timeout is not evidence a film does not
exist, so failures are never stored. Caching an outage propagates it.

In-process, not Redis: one instance serves this app, an empty cache after a
restart costs one lookup, and infrastructure added to look impressive is
infrastructure to operate.

## Security

- **Ownership.** Every query filters on `req.userId` from the verified token.
  Update and delete use `findOneAndUpdate({_id, user})`, so another user's id
  returns 404 rather than succeeding. Documents are built field by field, never
  by spreading the request body. Tested in both directions.
- **Rate limits.** 12/min per user on recommendations, 20/15min per IP on auth.
- **Untrusted input.** User text is wrapped in a delimited block whose markers
  are stripped from the content, under a system instruction that says text
  inside is data. Obvious injection attempts are detected and reported.
- **The real defence is after the model.** Schema validation, then film-database
  verification, then application-side filtering. A prompt that convinces the
  model to recommend a film that does not exist still produces nothing, because
  the model does not decide what is real.
- **Headers and limits.** `nosniff`, `DENY` framing, referrer policy, a
  permissions policy, a 100kb body cap, and an origin allowlist rather than `*`.
- **Secrets.** Only ever server-side. The frontend calls same-origin `/api`.

## Testing

| Layer | Count | What it covers |
|---|---|---|
| Pipeline units | 17 | validation, ranking, memory rules, context bounds |
| Journeys | 22 | real HTTP, real in-memory MongoDB, faked model and film DB |
| Other backend | 25 | model fallback, film lookup, path normalisation |
| Frontend | 38 | chat states, library states, store, memory, tour |

The journey tests are the ones worth having: signup and login, ownership
isolation in both directions, paging, a hallucinated film never reaching the
user, a model outage, unparseable output, rate limiting, oversized bodies, and
one person's conversation being invisible to another.

The model is never called for real in a test. A suite that needs a paid API is a
suite that gets deleted.

## Deployment

Two targets from one codebase. `backend/app.js` holds the routes;
`backend/server.js` adds `listen` and static file serving for Render;
`netlify/functions/api.js` wraps the same app with `serverless-http` for
Netlify, where cold start is about a second rather than 60–90.

CI runs install, lint, test and build on every push.

---

# Why we built it this way

## Verification against a film database, not trust in the model

**Decision.** The model proposes titles; TMDb or Wikipedia decides which exist;
the application decides which are shown.

**Why.** Ask any model for film recommendations and some of what comes back does
not exist — a plausible title, a plausible year, no such film. A recommender
that does that once is not trusted again.

**Alternative.** Prompt harder. "Only name real films, do not invent."

**Why not.** It reduces the rate and cannot reach zero, and the failure is
invisible: a fabricated title looks exactly like a real one until someone tries
to watch it.

**Tradeoff.** A network round trip per candidate, and real films get dropped
when the lookup cannot confirm them. Mitigated by caching and by asking for
eight to show five.

## Structured output with schema validation

**Decision.** Ask for JSON against a schema, then validate the parsed result in
code before anything reaches a user or the database.

**Why.** Free-form parsing is fragile in a way that fails silently. Constrained
decoding removes most malformed replies, and validation catches the rest —
duplicates, missing titles, a year of 3999.

**Alternative.** Parse natural language.

**Why not.** More code, more failure modes, and no way to tell "the model
refused" from "the parser broke".

**Tradeoff.** Slightly more constrained output, and a provider that does not
support schemas degrades to plain JSON mode.

## Bounded context with compaction, not a growing transcript

**Decision.** Six turns verbatim, everything older in one summary, hard caps on
preferences and exclusions.

**Why.** An unbounded transcript costs more every request forever, eventually
exceeds the window, and dilutes the current request.

**Alternative.** Send everything and let the provider truncate.

**Why not.** Truncation drops the oldest first, which is usually where the
durable preferences are — exactly the wrong thing to lose.

**Tradeoff.** Compaction is a model call, and a lossy one. Its failure is
handled explicitly rather than hidden.

## Preferences carry their source

**Decision.** Explicit statements are constraints; inferences need three
occurrences and lose to any explicit statement.

**Why.** Treating one click as a permanent fact is how a recommender becomes
confidently wrong about somebody, and the person has no way to see or correct
what it decided.

**Alternative.** Store every signal as a fact and let recency sort it out.

**Why not.** Recency cannot distinguish "changed their mind" from "clicked the
wrong thing once".

**Tradeoff.** Slower to learn, and a real preference stated obliquely may be
missed. A missed preference costs one mediocre suggestion; an invented one is
remembered forever.

## Constraints, and the model's knowledge cutoff

Someone asked for *"a new comedy film from 2026, similar to The Dictator"* and
got films from 1999, 2004 and 2010. Three failures stacked, only one of them the
model's:

1. Nothing extracted "2026" as a requirement — it was words in a prompt.
2. Nothing enforced it afterwards, so three films from the wrong century passed
   verification and ranking.
3. The prompt asked for *"at least three decades"*, which is right for "something
   funny" and exactly wrong for "something from 2026".

Underneath all three is the thing no prompt fixes: **a model cannot know about
films released after its training data ends.** Asking for 2026 releases does not
produce 2026 releases, it produces confident guesses.

So:

- `constraints.js` reads year windows deterministically — "from 2026", "the 90s",
  "before 2000", "since 2015", "the last 3 years", "new", "classic". Patterns run
  most specific first, so `before 2000` is not eaten by the bare year inside it.
- The constraint is **enforced in code after verification**, because the model's
  claimed year is a guess and verification replaces it with the real one.
- The prompt is told the requirement overrides the spread rule.
- A request for years past `MODEL_KNOWLEDGE_YEAR` is routed to **TMDb discover**
  (`catalogue.js`) when a key is configured — recency is a retrieval problem, not
  a generation one.
- With no catalogue key, the system **says so**: "what I know about films stops
  around 2025, and anything I offered for this year would be a guess dressed up
  as a fact." Returning something from 1999 and hoping nobody checks is the
  failure being prevented.

## Caching film facts but never recommendations

**Decision.** Public, immutable facts are cached for a day; personalised results
never are.

**Why.** The saving is real, the privacy risk is not worth it, and the key for a
personalised result would have to encode somebody's private taste profile.

**Alternative.** Cache by normalised intent.

**Why not.** Two people asking the same words are not asking the same question,
and a collision serves one person another's results.

**Tradeoff.** Repeat requests still pay for the model call.

## In-process cache and rate limiting, not Redis

**Decision.** Both live in memory in one process.

**Why.** One instance serves this app. A restart costs one lookup and one
minute of a rate-limit window.

**Alternative.** Redis.

**Why not.** An infrastructure dependency to operate, monitor and pay for, added
to a portfolio project to make a diagram look busier.

**Tradeoff.** Both become per-instance if this ever scales horizontally. Written
down in the code, not discovered later.

## A provider seam for the model and the film database

**Decision.** Both are reached through `services/providers.js`.

**Why.** ES module exports are immutable, so tests cannot substitute an imported
function. The seam lets the whole pipeline run over real HTTP with no key, and
makes swapping Groq or TMDb a change in one file.

**Alternative.** A mocking library that rewrites the module loader.

**Why not.** More machinery, and it hides that there was no seam.

**Tradeoff.** One layer of indirection on two calls.

## One conversation document per user

**Decision.** Turns, summary, preferences and history in a single document.

**Why.** It is always read and written together, it is a few kilobytes, and one
document is one round trip.

**Alternative.** A messages collection.

**Why not.** Paging through history is not something this does — the model only
ever sees a bounded slice.

**Tradeoff.** A single-document write on every turn, and a ceiling this would
outgrow if it ever became a messaging product.
