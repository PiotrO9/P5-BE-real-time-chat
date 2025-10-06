import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { updatePasswordSchema } from '../utils/validationSchemas';

const prisma = new PrismaClient();

export async function getUserProfile(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				username: true,
				createdAt: true,
				updatedAt: true,
				lastSeen: true,
			},
		});

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
			});
		}

		return res.status(200).json({
			user,
		});
	} catch (error) {
		next(error);
		return;
	}
}

export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const skip = (page - 1) * limit;

		const users = await prisma.user.findMany({
			select: {
				id: true,
				email: true,
				username: true,
				createdAt: true,
				lastSeen: true,
			},
			skip,
			take: limit,
			orderBy: {
				createdAt: 'desc',
			},
		});

		const totalUsers = await prisma.user.count();
		const totalPages = Math.ceil(totalUsers / limit);

		return res.status(200).json({
			users,
			pagination: {
				currentPage: page,
				totalPages,
				totalUsers,
				hasNext: page < totalPages,
				hasPrev: page > 1,
			},
		});
	} catch (error) {
		next(error);
		return;
	}
}

export async function updateUserProfile(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;
		const { username, email } = req.body;

		if (!username && !email) {
			return res.status(400).json({
				error: 'At least one field (username or email) is required',
			});
		}

		const existingUser = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!existingUser) {
			return res.status(404).json({
				error: 'User not found',
			});
		}

		if (email && email !== existingUser.email) {
			const emailExists = await prisma.user.findUnique({
				where: { email },
			});

			if (emailExists) {
				return res.status(400).json({
					error: 'Email already in use',
				});
			}
		}

		if (username && username !== existingUser.username) {
			const usernameExists = await prisma.user.findUnique({
				where: { username },
			});

			if (usernameExists) {
				return res.status(400).json({
					error: 'Username already in use',
				});
			}
		}

		const updatedUser = await prisma.user.update({
			where: { id: userId },
			data: {
				...(username && { username }),
				...(email && { email }),
				updatedAt: new Date(),
			},
			select: {
				id: true,
				email: true,
				username: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return res.status(200).json({
			message: 'User updated successfully',
			user: updatedUser,
		});
	} catch (error) {
		next(error);
		return;
	}
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
			});
		}

		await prisma.user.update({
			where: { id: userId },
			data: {
				deletedAt: new Date(),
			},
		});

		return res.status(200).json({
			message: 'User deleted successfully',
		});
	} catch (error) {
		next(error);
		return;
	}
}

export async function getUserStatus(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.params.id;

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
			});
		}

		return res.status(200).json({
			status: user.isOnline ? 'online' : 'offline',
		});
	} catch (error) {
		next(error);
		return;
	}
}

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

		if (currentPassword === newPassword) {
			return res.status(400).json({
				error: 'New password must be different from current password',
			});
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return res.status(404).json({
				error: 'User not found',
			});
		}

		const isMatch = await bcrypt.compare(currentPassword, user.password);
		if (!isMatch) {
			return res.status(400).json({
				error: 'Current password is incorrect',
			});
		}

		const hashedNewPassword = await bcrypt.hash(newPassword, 12);

		await prisma.user.update({
			where: { id: userId },
			data: { password: hashedNewPassword },
		});

		return res.status(200).json({
			message: 'Password updated successfully',
		});
	} catch (error) {
		next(error);
		return;
	}
}
