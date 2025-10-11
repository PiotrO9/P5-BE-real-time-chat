import { Router, Request, Response } from 'express';
import { userRoutes } from './userRoutes';
import { authRoutes } from './authRoutes';
import { friendsRoutes } from './friendsRoutes';

const router = Router();

// Health check endpoint
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

export { router };
