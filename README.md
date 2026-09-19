# Nitai's Movie Library 🎬

![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![CI](https://github.com/NitaiEdelberg/NitaisWebsite/actions/workflows/ci.yml/badge.svg)
![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)

A watchlist you keep, with a film recommender that **cannot invent films**.

Describe a mood — "something quiet for a rainy night" — and keep talking until
it gets there. The model proposes titles; a real film database decides which
exist; anything it made up is dropped before you see it, and the count of what
was dropped is printed under every answer.

🌐 **[Try it](https://nitaiswebsite.onrender.com)** · 📐 **[Architecture and the
decisions behind it](docs/ARCHITECTURE.md)**

---

## Why this is interesting

Ask any chatbot for film recommendations and some of what comes back does not
exist: a plausible title, a plausible year, a plausible director, and no such
film. That is not a bug in the prompt, it is what a language model does — and it
is the reason this project treats the model as one stage of a pipeline rather
than as the answer.

```
message → context → prompt → model → validate → verify → filter → rank → reply
                                        │          │
                              shape enforced   film database
                                 in code       decides what exists
```

The model never decides what is true. It proposes titles; the application
verifies them, filters what you have already seen, ranks what is left, and shows
its working:

> *8 suggested · 5 verified as real · 3 dropped as unverifiable · 1 you'd already seen*

---

---

## What it does

**Your library.** Sign up, add films with a year and an optional poster, score
them out of ten, and write a private note about why one stuck with you. Search,
sort and filter. Every library is private to its account, enforced server-side.

**The recommender.** A conversation, not a form. Ask for a mood, then refine —
"lighter", "seen it", "more like the second one". It remembers across sessions:

- what it has already shown you, so the same five films do not come back;
- what you own, so it never suggests a film already in your library;
- what you turned down;
- what you told it about your taste — and separately, what it has merely
  guessed, which needs to recur three times before it counts.

**Constraints are enforced, not hoped for.** Ask for "a comedy from the 90s" and
anything outside 1990–1999 is dropped after verification, with the count shown.
Ask for something newer than the model can possibly know about and it either
looks it up in a real catalogue or tells you it cannot — rather than quietly
answering with a film from 1999.

**What it shows you.** The model's one-line reason is labelled *why this*;
everything beside it comes from a film database. Under each answer, how many
suggestions were proposed, verified and discarded.

**What it remembers, and how to see it.** `GET /api/ai/memory` returns every
preference it holds, whether you stated it or it was inferred, and how strongly.
`DELETE /api/ai/memory` forgets all of it.

## Stack

- **Frontend:** React + Vite + Chakra UI
- **Backend:** Express 5 on Node 20
- **Database:** MongoDB Atlas (Mongoose)
- **Model:** Groq (`openai/gpt-oss-120b`, with a fallback chain)
- **Verification:** TMDb when a key is set, Wikipedia when not — the keyless
  path is the tested default, not a stub
- **Deployment:** Render (long-lived Node) or Netlify (serverless function) from
  the same codebase

---

## 📂 Project Structure:

```
/frontend
    /public
        favicon.png
    /src
        /components
            Navbar.jsx
            MovieCard.jsx
        /pages
            CreatePage.jsx
            HomePage.jsx
        /store
            movie.js
    main.jsx
/backend
    /controllers
        movie.controller.js
    /models
        movie.model.js
    /routes
        movie.route.js
    server.js
.env
package.json
```

---

## 📦 Installation and Running Locally

### 1. Clone the Repository

```bash
git clone https://github.com/NitaiEdelberg/NitaisWebsite.git
cd NitaisWebsite
```

---

### 2. Setup Environment Variables

Create a `.env` file in the root:

```bash
MONGO_URI=your-mongodb-connection-string
PORT=5000

# AI recommendations
GROQ_API_KEY=your-groq-key         # required for the "recommend a movie" feature
TMDB_API_KEY=your-tmdb-key         # optional — enables real posters + best data
```

The AI feature proposes candidate titles with Groq, then **grounds** each one in
a real source before showing it: TMDb when `TMDB_API_KEY` is set (real posters),
otherwise a keyless Wikipedia lookup. Titles that can't be verified are dropped,
so the assistant never invents a movie. `.env` is already in `.gitignore`.

---

### 3. Install Dependencies

```bash
npm install
npm install --prefix frontend
```

---

### 4. Run Development Server

Start backend:

```bash
npm run dev
```

Start frontend:

```bash
npm run dev --prefix frontend
```

---

## 🚀 Building for Production

To build the frontend:

```bash
npm run build --prefix frontend
```

To run the backend in production:

```bash
npm run start
```

---

## API

Every route below `/api/movies` and `/api/ai` requires a bearer token, and every
query is scoped to the authenticated user — never to an id in the request.

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register` | 8–72 character password; email normalised, so one address is one account |
| POST | `/api/auth/login` | Returns a 7-day JWT. Rate limited, 20 per 15 min per IP |
| GET | `/api/movies?page=1&limit=100` | Paged, newest first, owner id never returned |
| POST | `/api/movies` | Validates year and score; the document is built field by field, so a `user` in the body is ignored |
| PUT | `/api/movies/:id` | Scoped to the owner — somebody else's id is a 404, not a success |
| DELETE | `/api/movies/:id` | Same |
| POST | `/api/ai/recommend` | The conversation. Rate limited, 12/min per user |
| POST | `/api/ai/reject` | "Not for me" — blocks that title, and counts weakly against its genre |
| GET | `/api/ai/memory` | Everything remembered about your taste, and whether you said it or it was inferred |
| DELETE | `/api/ai/memory` | Forget all of it |
| GET | `/api/health` | Liveness, touching no database |

### A recommendation response

```json
{
  "success": true,
  "reply": "Two quiet ones, both about small lives rather than big events.",
  "movies": [
    {
      "title": "Paterson",
      "year": 2016,
      "why": "A week of small kindnesses, nothing louder.",
      "overview": "A bus driver in New Jersey writes poems between shifts.",
      "poster": "https://…",
      "rating": 7.2,
      "source": "wikipedia"
    }
  ],
  "trace": {
    "proposed": 8, "verified": 5, "unverifiable": 3,
    "blocked_as_seen": 1, "shown": 2, "preferences_used": 2, "ms": 4210
  }
}
```

`why` is the only field the model wrote. Everything else was verified.

---

## Testing

```bash
npm test                        # 64 backend tests
npm test --prefix frontend      # 38 component and store tests
npm run lint --prefix frontend
```

No test calls a real model or a real film database. The journey suite starts a
real MongoDB in memory and swaps both outside dependencies through a provider
seam, so schemas, indexes and ownership rules are exercised for real while the
expensive parts are faked.

| Layer | What it covers |
|---|---|
| Journeys (22) | signup, login, ownership isolation both ways, paging, hallucinated films, model outage, unparseable output, rate limiting, oversized bodies, one user's conversation being invisible to another |
| Pipeline (17) | validation, ranking and diversity, memory rules, context staying bounded as a conversation grows |
| Client (38) | chat states, retry without retyping, error vs empty library, store, persistent memory |

CI runs install, lint, tests and build on every push and pull request.

---

## Known limitations

Written down rather than discovered:

- **The rate limiter and cache are per process.** One instance serves this app.
  On several instances both become per-instance and the numbers need dividing.
- **Netlify functions time out at 10 seconds.** The library is well under one; a
  recommendation has measured 3–15 because it verifies every title. If that
  starts timing out, `/api/ai/*` can stay on Render with one redirect — written
  out in [docs/DEPLOY_NETLIFY.md](docs/DEPLOY_NETLIFY.md).
- **Preference extraction is a model call**, so it can be wrong. Its blast
  radius is bounded: a closed vocabulary, a repetition threshold for inferences,
  and a visible, clearable memory.
- **Recommendation quality is not measured.** Hallucination is (verified vs
  unverifiable, in every response). Whether the five films are *good* is not,
  and that would need labelled judgements.
- **No E2E browser tests.** The journey tests cover the API end to end;
  Playwright would cover the browser, and the system libraries it needs are not
  installed here.

## Future Improvements

- Public sharing of movie lists
- Upload real image files instead of URL

---

## 📸 Screenshot

![App Screenshot](./frontend/public/screenshot.png)

---

## 💬 Contact

Made by [Nitai Edelberg](https://github.com/NitaiEdelberg)

---

## Acknowledgements

- [Chakra UI](https://chakra-ui.com/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Render.com](https://render.com/)
- [Icons8 Star Icon](https://icons8.com/icons/set/star)


