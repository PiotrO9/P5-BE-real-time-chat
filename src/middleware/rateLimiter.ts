/// <reference path="../types/express.d.ts" />
/// <reference path="../types/express-rate-limit.d.ts" />
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter dla wysyłania wiadomości
 * 30 wiadomości na minutę z jednego IP
 */
export const sendMessageRateLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minuta
	max: 30, // maksymalnie 30 wiadomości na minutę
	message: {
		success: false,
		message: 'Too many messages. Please try again later.',
	},
	standardHeaders: true, // zwraca informacje o limicie w nagłówkach `RateLimit-*`
	legacyHeaders: false, // wyłącza nagłówki `X-RateLimit-*`
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
