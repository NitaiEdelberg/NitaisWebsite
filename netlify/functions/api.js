// The whole API as one Netlify function.
//
// Why this exists: on Render's free tier the instance sleeps after 15 minutes
// and takes 60-90 seconds to wake, so the first visitor of the day stares at a
// spinner. A function cold-starts in about a second, and a warm one in
// milliseconds.
//
// Two things make that true rather than aspirational:
//   - the Mongo connection is cached at module scope (see config/db.js), so a
//     warm container does no connecting;
//   - the connection is established BEFORE the request is handed to Express,
//     because a handler that returns while Mongoose is still buffering gives
//     the caller a timeout instead of an answer.
import serverless from "serverless-http";

import app from "../../backend/app.js";
import { connectDB } from "../../backend/config/db.js";

const handle = serverless(app);

// Netlify's rewrite can hand this function the original client path
// ("/api/movies"), the rewritten one ("/.netlify/functions/api/movies"), or the
// same with the mount point doubled — and which one depends on platform
// behaviour that is not worth betting a deploy on. serverless-http passes
// event.path straight to Express, so all three are normalised to the path
// Express actually mounts. Verified against all three shapes in the tests.
const FUNCTION_PREFIX = "/.netlify/functions/api";

export function normalisePath(path) {
    let route = path || "/";
    if (route.startsWith(FUNCTION_PREFIX)) {
        route = route.slice(FUNCTION_PREFIX.length) || "/";
    }
    if (!route.startsWith("/api")) {
        route = "/api" + (route === "/" ? "" : route);
    }
    return route;
}

export const handler = async (event, context) => {
    // Let the response return without waiting for the event loop to drain:
    // the pooled Mongo connection keeps it alive on purpose.
    context.callbackWaitsForEmptyEventLoop = false;

    const route = normalisePath(event.path || event.rawPath);
    const request = { ...event, path: route, rawPath: route };

    // A liveness check that needs the database is not a liveness check: it
    // answers before anything is connected, so a platform ping stays honest
    // about the function rather than about Atlas.
    if (route === "/api/health") {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ok" }),
        };
    }

    try {
        await connectDB();
    } catch (error) {
        console.error("Mongo unavailable:", error.message);
        return {
            statusCode: 503,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                success: false,
                message: "The database is unavailable right now. Try again in a moment.",
            }),
        };
    }

    return handle(request, context);
};
