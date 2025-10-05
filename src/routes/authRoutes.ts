import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/authController';
import { authenticateToken, authenticateTokenWithoutRefresh } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes (authentication required)
// Using authenticateToken with sliding session - refreshes token on each successful call
router.get('/me', authenticateToken, me);

// Example: If you want to use authentication WITHOUT sliding session for specific endpoints:
// router.get('/some-endpoint', authenticateTokenWithoutRefresh, someController);

export { router as authRoutes };
