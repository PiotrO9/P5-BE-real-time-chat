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
		message: 'Zbyt wiele wiadomości. Spróbuj ponownie za chwilę.',
	},
	standardHeaders: true, // zwraca informacje o limicie w nagłówkach `RateLimit-*`
	legacyHeaders: false, // wyłącza nagłówki `X-RateLimit-*`
	handler: (req: Request, res: Response) => {
		res.status(429).json({
			success: false,
			message: 'Zbyt wiele wiadomości. Spróbuj ponownie za chwilę.',
			retryAfter: Math.ceil(
				((req.rateLimit?.resetTime || Date.now() + 60 * 1000) - Date.now()) / 1000,
			),
		});
	},
});
