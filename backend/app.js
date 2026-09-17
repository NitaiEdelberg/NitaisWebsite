// The Express app, with no server attached.
//
// Split out from server.js so the same routes can run in two places: a
// long-lived Node process on Render (server.js) and a serverless function on
// Netlify (netlify/functions/api.js). Nothing here may call app.listen() or
// process.exit(): a function that exits takes the whole invocation with it.
import express from "express";
import dotenv from "dotenv";

import movieRoutes from "./routes/movie.route.js";
import aiRoutes from "./routes/ai.route.js";
import authRoutes from "./routes/auth.route.js";

dotenv.config();

const app = express();

app.use(express.json());

// Cheap liveness check that touches no database, so a platform can ping it.
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/movies", movieRoutes);

export default app;
