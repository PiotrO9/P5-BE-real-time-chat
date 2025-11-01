import { Router, Request, Response } from 'express';
import { userRoutes } from './userRoutes';
import { authRoutes } from './authRoutes';
import { friendsRoutes } from './friendsRoutes';
import { chatRoutes } from './chatRoutes';
import { messagesRoutes } from './messagesRoutes';
import { seedRoutes } from './seedRoutes';

const router = Router();

/**
 * @route GET /api/health
 * @desc Health check endpoint for API status
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
	res.json({
		status: 'OK',
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
		memory: process.memoryUsage(),
	});
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/friends', friendsRoutes);
router.use('/chats', chatRoutes);
router.use('/messages', messagesRoutes);
router.use('/seed', seedRoutes);

export { router };
