import { Request, Response, NextFunction } from 'express';
import { updatePasswordSchema } from '../utils/validationSchemas';
import { UserService } from '../services/userService';
import { UserServiceError } from '../types/user';

const userService = new UserService();

/**
 * Get user profile by ID
 * GET /api/users/:id
 */
export async function getUserProfile(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;
		const user = await userService.getUserProfile(userId);

		return res.status(200).json({
			user,
		});
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}

/**
 * Get all users with pagination
 * GET /api/users
 */
export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;

		const result = await userService.getAllUsers({ page, limit });

		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}

/**
 * Update user profile (username or email)
 * PUT /api/users/:id
 */
export async function updateUserProfile(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;
		const { username, email } = req.body;

		const updatedUser = await userService.updateUserProfile(userId, { username, email });

		return res.status(200).json({
			message: 'User updated successfully',
			user: updatedUser,
		});
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}

/**
 * Soft delete user (set deletedAt)
 * DELETE /api/users/:id
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;

		await userService.deleteUser(userId);

		return res.status(200).json({
			message: 'User deleted successfully',
		});
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}

/**
 * Get user online status
 * GET /api/users/:id/status
 */
export async function getUserStatus(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;
		const status = await userService.getUserStatus(userId);

		return res.status(200).json(status);
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}

/**
 * Update user password
 * PUT /api/users/:id/password
 */
export async function updateUserPassword(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;

		if (!req.user || req.user.userId !== userId) {
			return res.status(403).json({
				error: 'You can only change your own password',
			});
		}

		const validationResult = updatePasswordSchema.safeParse(req.body);

		if (!validationResult.success) {
			return res.status(400).json({
				error: 'Validation failed',
				details: validationResult.error.issues.map(issue => ({
					field: issue.path.join('.'),
					message: issue.message,
				})),
			});
		}

		const { currentPassword, newPassword } = validationResult.data;

		await userService.updateUserPassword(userId, { currentPassword, newPassword });

		return res.status(200).json({
			message: 'Password updated successfully',
		});
	} catch (error) {
		if (error instanceof UserServiceError) {
			return res.status(error.statusCode).json({
				error: error.message,
			});
		}
		next(error);
		return;
	}
}
