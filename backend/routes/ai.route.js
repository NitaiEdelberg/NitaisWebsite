import express from 'express';
import { getMovieRecommendation } from '../controllers/ai.controller.js';

const router = express.Router();

router.post('/recommend', getMovieRecommendation);

export default router;
