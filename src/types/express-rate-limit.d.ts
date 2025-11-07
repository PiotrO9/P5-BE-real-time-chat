declare module 'express-rate-limit' {
	import { Request, Response, NextFunction } from 'express';

	export interface RateLimitInfo {
		limit: number;
		current: number;
		remaining: number;
		resetTime: Date | number;
	}

	export interface RateLimitOptions {
		windowMs?: number;
		max?: number | ((req: Request) => number | Promise<number>);
		message?: string | object | ((req: Request) => string | object);
		standardHeaders?: boolean;
		legacyHeaders?: boolean;
		handler?: (req: Request, res: Response, next: NextFunction, options: RateLimitOptions) => void;
		skip?: (req: Request) => boolean | Promise<boolean>;
		skipSuccessfulRequests?: boolean;
		skipFailedRequests?: boolean;
		keyGenerator?: (req: Request) => string | Promise<string>;
		store?: any;
		onLimitReached?: (req: Request, res: Response, options: RateLimitOptions) => void;
	}

	export interface RateLimitRequestHandler {
		(req: Request, res: Response, next: NextFunction): void;
		keyGenerator?: (req: Request) => string | Promise<string>;
		resetKey?: (key: string) => void;
	}

	function rateLimit(options?: RateLimitOptions): RateLimitRequestHandler;

	export default rateLimit;
}

