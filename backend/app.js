// The Express app, with no server attached.
//
// Split from server.js so the same routes run in two places: a long-lived Node
// process on Render (server.js) and a serverless function on Netlify
// (netlify/functions/api.js). Nothing here may call app.listen() or
// process.exit(): a function that exits takes the invocation with it.
import express from "express";
import dotenv from "dotenv";

import movieRoutes from "./routes/movie.route.js";
import aiRoutes from "./routes/ai.route.js";
import authRoutes from "./routes/auth.route.js";
import { cors, securityHeaders } from "./middleware/security.js";
import { requestContext } from "./utils/requestLog.js";

dotenv.config();

const app = express();

// Behind Render and Netlify, the client address is in X-Forwarded-For. Without
// this, every rate-limit bucket keyed by IP would be the proxy's.
app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(cors);
app.use(requestContext);

// A CV, a note and a chat message are all small. The cap is what stops a
// megabyte of JSON from becoming a megabyte of parsing before any route runs.
app.use(express.json({ limit: "100kb" }));

// Cheap liveness check that touches no database, so a platform can ping it.
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/movies", movieRoutes);

// A body that is not JSON, or is too large, should say so rather than
// surfacing as a stack trace or a generic 500.
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "That request was too large." });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "That request wasn't valid JSON." });
  }
  console.error("unhandled error:", err?.message);
  return res.status(500).json({ success: false, message: "Something went wrong on our side." });
});

export default app;
