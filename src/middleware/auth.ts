import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
	verifyAccessToken,
	TokenPayload,
	generateAccessToken,
	setAccessTokenCookie,
	SLIDING_SESSION_ENABLED,
} from '../utils/jwt';
import { refreshAccessToken } from '../services/authService';
import { AuthServiceError } from '../types/auth';

declare global {
	namespace Express {
		interface Request {
			user?: TokenPayload;
		}
	}
}

/**
 * Check if error is a JWT-related error (expired or invalid token)
 */
function isJwtError(error: unknown): error is jwt.TokenExpiredError | jwt.JsonWebTokenError {
	return error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError;
}

/**
 * Handle refresh token flow when access token is expired or invalid
 */
async function handleTokenRefresh(
	refreshToken: string,
	res: Response,
): Promise<TokenPayload | null> {
	try {
		const newAccessToken = await refreshAccessToken(refreshToken);
		const decoded = verifyAccessToken(newAccessToken);

		setAccessTokenCookie(res, newAccessToken);
		res.setHeader('X-Token-Refreshed', 'true');

		return decoded;
	} catch (refreshError) {
		if (refreshError instanceof AuthServiceError) {
			res.status(refreshError.statusCode).json({
				success: false,
				message: refreshError.message,
			});
			return null;
		}

		res.status(401).json({
			success: false,
			message: 'Failed to refresh access token',
		});
		return null;
	}
}

/**
 * Apply sliding session - refresh access token if enabled
 */
function applySlidingSession(decoded: TokenPayload, res: Response): void {
	if (!SLIDING_SESSION_ENABLED) {
		return;
	}

	const newAccessToken = generateAccessToken({
		userId: decoded.userId,
		email: decoded.email,
	});

	setAccessTokenCookie(res, newAccessToken);
	res.setHeader('X-Token-Refreshed', 'true');
}

/**
 * Middleware to authenticate user using JWT from cookies
 * Automatically refreshes access token on successful authentication (sliding session)
 * If access token expired, automatically uses refresh token to get new access token
 */
export const authenticateToken = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { accessToken, refreshToken } = req.cookies;

		if (!accessToken) {
			res.status(401).json({
				success: false,
				message: 'Access token required',
			});
			return;
		}

		let decoded: TokenPayload;
		let tokenWasRefreshed = false;

		try {
			decoded = verifyAccessToken(accessToken);
		} catch (error) {
			if (!isJwtError(error)) {
				throw error;
			}

			if (!refreshToken) {
				res.status(401).json({
					success: false,
					message: 'Access token expired and no refresh token provided',
				});
				return;
			}

			const refreshedDecoded = await handleTokenRefresh(refreshToken, res);
			if (!refreshedDecoded) {
				return; // Error already handled in handleTokenRefresh
			}

			decoded = refreshedDecoded;
			tokenWasRefreshed = true;
		}

		req.user = decoded;

		if (!tokenWasRefreshed) {
			applySlidingSession(decoded, res);
		}

		next();
	} catch (error) {
		res.status(403).json({
			success: false,
			message: 'Invalid or expired access token',
		});
	}
};

/**
 * Middleware to authenticate user using JWT from cookies
 * WITHOUT automatic token refresh (for endpoints where you don't want sliding session)
 */
export const authenticateTokenWithoutRefresh = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	try {
		const { accessToken } = req.cookies;

		if (!accessToken) {
			res.status(401).json({
				success: false,
				message: 'Access token required',
			});
			return;
		}

		const decoded = verifyAccessToken(accessToken);
		req.user = decoded;
		next();
	} catch (error) {
		res.status(403).json({
			success: false,
			message: 'Invalid or expired access token',
		});
	}
};

/**
 * Middleware to authorize user modifications (only own profile)
 */
export const authorizeUserModification = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	const requestedUserId = req.params.id;
	const authenticatedUserId = req.user?.userId;

	if (!authenticatedUserId) {
		res.status(401).json({
			success: false,
			message: 'Authentication required',
		});
		return;
	}

	if (requestedUserId !== authenticatedUserId) {
		res.status(403).json({
			success: false,
			message: 'You can only modify your own profile',
		});
		return;
	}

	next();
};
