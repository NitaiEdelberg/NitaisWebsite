import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import path from "path";

import movieRoutes from "./routes/movie.route.js";
import aiRoutes from './routes/ai.route.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __dirname = path.resolve(); // to get the current directory name

app.use(express.json()); // allows to accept JSON data in the req.body

app.use("/api/ai", aiRoutes);

app.use("/api/movies",movieRoutes);
// Serve frontend files in production
if(process.env.NODE_ENV.trim() === "production"){
    app.use(express.static(path.join(__dirname,"/frontend/dist")));
// if the request is for any route other than /api/products, serve the index.html file
    app.get(/^\/(?!api).*$/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
    });
}

app.listen(PORT, () => {
    connectDB();
    console.log("server started at http://localhost:" + PORT);
})

