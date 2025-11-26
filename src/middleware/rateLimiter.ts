/// <reference path="../types/express.d.ts" />
/// <reference path="../types/express-rate-limit.d.ts" />
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for sending messages
 * 30 messages per minute from one IP
 */
export const sendMessageRateLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 30, // maximum 30 messages per minute
	message: {
		success: false,
		message: 'Too many messages. Please try again later.',
	},
	standardHeaders: true, // returns limit information in `RateLimit-*` headers
	legacyHeaders: false, // disables `X-RateLimit-*` headers
	handler: (req: Request, res: Response) => {
		const resetTime = req.rateLimit?.resetTime
			? typeof req.rateLimit.resetTime === 'number'
				? req.rateLimit.resetTime
				: req.rateLimit.resetTime.getTime()
			: Date.now() + 60 * 1000;

		res.status(429).json({
			success: false,
			message: 'Too many messages. Please try again later.',
			retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
		});
	},
});
