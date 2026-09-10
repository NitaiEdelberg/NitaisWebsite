import express from 'express';
import { getMovieRecommendation } from '../controllers/ai.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Logged in only: the box that calls this is on the home page, which is behind
// login anyway, and without the guard this route is an open proxy to my Groq
// key that anyone can bill.
router.post('/recommend', authMiddleware, getMovieRecommendation);

export default router;
