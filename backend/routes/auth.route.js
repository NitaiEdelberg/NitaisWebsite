import express from 'express';
import { authRateLimit } from '../middleware/rateLimit.js';
import { loginUser, registerUser } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', authRateLimit, registerUser);
router.post('/login', authRateLimit, loginUser);

export default router;
