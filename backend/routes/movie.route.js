import express from 'express'; 

import { createMovie, deleteMovie, getMovies, updateMovie } from '../controllers/movie.controller.js';

const router = express.Router();

router.get("/", getMovies);
router.post("/",createMovie);
router.delete("/:id",deleteMovie);
router.put("/:id",updateMovie);

export default router;