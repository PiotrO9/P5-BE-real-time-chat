import jwt from 'jsonwebtoken';
import { Response } from 'express';

export interface TokenPayload {
	userId: string;
	email: string;
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your-access-secret-key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export const SLIDING_SESSION_ENABLED = process.env.SLIDING_SESSION_ENABLED !== 'false';

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
	return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN,
	});
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
	return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRES_IN,
	});
};

/**
 * Verify access token
 * Throws original JWT error (TokenExpiredError, JsonWebTokenError, etc.) for proper error handling
 */
export const verifyAccessToken = (token: string): TokenPayload => {
	return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

/**
 * Verify refresh token
 * Throws original JWT error (TokenExpiredError, JsonWebTokenError, etc.) for proper error handling
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
	return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
};

/**
 * Set authentication cookies in response
 */
export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
	res.cookie('accessToken', accessToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: 15 * 60 * 1000,
	});

	res.cookie('refreshToken', refreshToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production', // HTTPS only in production
		sameSite: 'strict',
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
	});
};

/**
 * Clear authentication cookies
 */
export const clearAuthCookies = (res: Response): void => {
	res.clearCookie('accessToken');
	res.clearCookie('refreshToken');
};

/**
 * Cookie options for access token
 */
const ACCESS_TOKEN_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict' as const,
	maxAge: 15 * 60 * 1000, // 15 minutes
};

/**
 * Set access token cookie in response
 */
export const setAccessTokenCookie = (res: Response, accessToken: string): void => {
	res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
};
