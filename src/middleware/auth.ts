import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';

declare global {
	namespace Express {
		interface Request {
			user?: TokenPayload;
		}
	}
}

/**
 * Middleware to authenticate user using JWT from cookies
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
	try {
		const { accessToken } = req.cookies;

		if (!accessToken) {
			res.status(401).json({
				success: false,
				message: 'Access token required',
			});
			return;
		}

		// Verify access token
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
