import express from 'express'; 
import { authMiddleware } from '../middleware/auth.js';

import { createMovie, deleteMovie, getMovies, updateMovie } from '../controllers/movie.controller.js';

const router = express.Router();

router.get("/", authMiddleware, getMovies);
router.post("/", authMiddleware, createMovie);
router.delete("/:id", authMiddleware, deleteMovie);
router.put("/:id", authMiddleware, updateMovie);

export default router;