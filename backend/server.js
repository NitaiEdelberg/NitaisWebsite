// The Render entry point: a long-lived Node process that also serves the built
// frontend. Netlify uses netlify/functions/api.js instead, which wraps the same
// app without any of this.
import path from "path";
import express from "express";

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Guarded because an unset NODE_ENV used to crash the process on startup.
if ((process.env.NODE_ENV || "").trim() === "production") {
    app.use(express.static(path.join(__dirname, "/frontend/dist")));
    app.get(/^\/(?!api).*$/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
    });
}

connectDB().catch((error) => {
    console.error(`Mongo connection failed: ${error.message}`);
    process.exit(1);
});

app.listen(PORT, () => console.log(`server started on ${PORT}`));
