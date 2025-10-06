import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
	email: z.string().email('Invalid email format'),
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters')
		.max(30, 'Username must be less than 30 characters'),
	password: z
		.string()
		.min(6, 'Password must be at least 6 characters')
		.max(100, 'Password must be less than 100 characters'),
});

const loginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1, 'Password is required'),
});

export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
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
};

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
