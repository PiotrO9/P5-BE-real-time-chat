import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import {
	generateAccessToken,
	generateRefreshToken,
	verifyRefreshToken,
	setAuthCookies,
	clearAuthCookies,
	TokenPayload,
} from '../utils/jwt';

const prisma = new PrismaClient();

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, username, password } = req.body;

		if (!email || !username || !password) {
			res.status(400).json({
				success: false,
				message: 'Email, username, and password are required',
			});
			return;
		}

		const existingUser = await prisma.user.findFirst({
			where: {
				OR: [{ email }, { username }],
			},
		});

		if (existingUser) {
			res.status(409).json({
				success: false,
				message: 'User with this email or username already exists',
			});
			return;
		}

		const saltRounds = 12;
		const hashedPassword = await bcrypt.hash(password, saltRounds);

		const newUser = await prisma.user.create({
			data: {
				email,
				username,
				password: hashedPassword,
			},
		});

		res.status(201).json({
			success: true,
			message: 'User registered successfully',
		});
	} catch (error) {
		console.error('Registration error:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			res.status(400).json({
				success: false,
				message: 'Email and password are required',
			});
			return;
		}

		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			res.status(401).json({
				success: false,
				message: 'Invalid credentials',
			});
			return;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			res.status(401).json({
				success: false,
				message: 'Invalid credentials',
			});
			return;
		}

		const tokenPayload: TokenPayload = {
			userId: user.id,
			email: user.email,
		};

		const accessToken = generateAccessToken(tokenPayload);
		const refreshToken = generateRefreshToken(tokenPayload);

		await prisma.refreshToken.create({
			data: {
				token: refreshToken,
				userId: user.id,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
			},
		});

		setAuthCookies(res, accessToken, refreshToken);

		await prisma.user.update({
			where: { id: user.id },
			data: { lastSeen: new Date() },
		});

		res.status(200).json({
			success: true,
			message: 'Login successful',
			data: {
				user: {
					username: user.username,
					email: user.email,
					id: user.id,
				},
			},
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
	try {
		const { refreshToken } = req.cookies;

		if (!refreshToken) {
			res.status(401).json({
				success: false,
				message: 'Refresh token not found',
			});
			return;
		}

		let tokenPayload: TokenPayload;
		try {
			tokenPayload = verifyRefreshToken(refreshToken);
		} catch (error) {
			res.status(401).json({
				success: false,
				message: 'Invalid refresh token',
			});
			return;
		}

		const storedToken = await prisma.refreshToken.findUnique({
			where: { token: refreshToken },
			include: { user: true },
		});

		if (!storedToken || storedToken.expiresAt < new Date()) {
			res.status(401).json({
				success: false,
				message: 'Refresh token expired or not found',
			});
			return;
		}

		const newAccessToken = generateAccessToken({
			userId: storedToken.user.id,
			email: storedToken.user.email,
		});

		res.cookie('accessToken', newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: 15 * 60 * 1000, // 15 minutes
		});

		res.status(200).json({
			success: true,
			message: 'Access token refreshed successfully',
		});
	} catch (error) {
		console.error('Refresh token error:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
	try {
		const { refreshToken } = req.cookies;

		if (refreshToken) {
			await prisma.refreshToken.deleteMany({
				where: { token: refreshToken },
			});
		}

		clearAuthCookies(res);

		res.status(200).json({
			success: true,
			message: 'Logout successful',
		});
	} catch (error) {
		console.error('Logout error:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};

/**
 * Get current user data
 * GET /api/auth/me
 */
export const me = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = (req as any).user?.userId;

		if (!userId) {
			res.status(401).json({
				success: false,
				message: 'User not authenticated',
			});
			return;
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				email: true,
				username: true,
				createdAt: true,
				lastSeen: true,
			},
		});

		if (!user) {
			res.status(404).json({
				success: false,
				message: 'User not found',
			});
			return;
		}

		res.status(200).json({
			success: true,
			data: {
				user,
			},
		});
	} catch (error) {
		console.error('Get user data error:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error',
		});
	}
};
