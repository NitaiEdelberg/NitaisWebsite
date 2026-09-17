import express from 'express';
import {
  getMovieRecommendation, rejectRecommendation, getMemory, forgetMemory,
} from '../controllers/ai.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Every route here is signed-in only. Without the guard this is an open proxy
// to a paid model API, and the memory it reads and writes belongs to one
// person.
router.use(authMiddleware);

router.post('/recommend', aiRateLimit, getMovieRecommendation);
router.post('/reject', rejectRecommendation);
router.get('/memory', getMemory);
router.delete('/memory', forgetMemory);

export default router;
