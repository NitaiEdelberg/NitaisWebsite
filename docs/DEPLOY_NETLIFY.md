# Moving the movie site to Netlify

Why: Render's free instance sleeps after 15 minutes and takes 60–90 seconds to
wake. Measured this week: 51s, 62s, 91s. A Netlify function cold-starts in about
a second, and a warm one in milliseconds. The code is already there
(`netlify/functions/api.js`); this is the ten minutes of clicking that turns it
on.

Render keeps working throughout. Nothing here breaks the old deploy, so you can
compare the two and only then stop using one.

## 1. Create the site

1. https://app.netlify.com → **Add new site** → **Import an existing project**
2. Pick GitHub → `NitaiEdelberg/NitaisWebsite`
3. Leave the build settings alone — `netlify.toml` already sets them:
   - build: `npm install && npm install --prefix frontend && npm run build --prefix frontend`
   - publish: `frontend/dist`
   - functions: `netlify/functions`

## 2. Set four environment variables

**Site configuration → Environment variables.** Copy the values from the Render
service (Environment tab) so both deployments talk to the same database.

| Variable | Where it comes from | What breaks without it |
|---|---|---|
| `MONGO_URI` | Render, same value | Everything: the API answers 503 |
| `JWT_SECRET` | Render, same value | Logins fail. **Must match Render**, or tokens issued by one are rejected by the other |
| `GROQ_API_KEY` | Render, same value | AI suggestions only; the rest of the site is fine |
| `TMDB_API_KEY` | optional | Posters stay generated SVGs instead of real artwork |

`JWT_SECRET` matching matters more than it looks: while both deployments are
live, a token from one has to work on the other, or moving between them logs
people out.

## 3. Let Atlas accept the connection

MongoDB Atlas → **Network Access**. Netlify functions have no fixed outbound IP,
so the allowlist has to be `0.0.0.0/0`. That is how every serverless host works
with Atlas, and the connection is still authenticated and TLS-encrypted — but it
is worth knowing rather than clicking past.

## 4. Check it

```bash
curl https://<your-site>.netlify.app/api/health        # {"status":"ok"} — no DB needed
curl https://<your-site>.netlify.app/api/movies        # 401: the route is alive and guarded
```

Then open the site, log in, add a film, and ask for a suggestion. The thing to
watch is the second visit after twenty minutes idle — that is where Render used
to cost you a minute.

## 5. Afterwards

- **Turn off the Render keep-alive.** `.github/workflows/keep-alive.yml` pings
  the Render instance to stop it sleeping. Once traffic goes to Netlify it is
  spending account-wide free instance-hours for nothing — and those hours are
  shared with amtza and JailbreakAPI, where they are worth more.
- **Point the profile README and CV at the Netlify URL** once you trust it.
- Leave the Render service up for a while. It costs nothing while idle, and it
  is the fallback if a function limit surprises you.

## What to expect, honestly

**Better:** no cold start worth noticing. The CDN serves the page instantly and
the function wakes in about a second.

**The same:** the database. Atlas is unchanged, so anything already saved is
still there, on both deployments.

**Worth watching:** Netlify's free functions time out at **10 seconds**. The
watchlist calls return in well under a second, but an AI suggestion asks Groq
for titles and then verifies each one against Wikipedia, which has measured
between 3 and 15 seconds. If suggestions start timing out on Netlify while
working on Render, that is the cause, and the fix is to keep `/api/ai/*` pointed
at Render with one redirect rule while everything else stays on the function:

```toml
[[redirects]]
  from = "/api/ai/*"
  to = "https://nitaiswebsite.onrender.com/api/ai/:splat"
  status = 200
  force = true
```

That rule has to come **before** the general `/api/*` rule in `netlify.toml`,
because the first match wins.
