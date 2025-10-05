import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes (authentication required)
router.get('/me', authenticateToken, me);

export { router as authRoutes };
