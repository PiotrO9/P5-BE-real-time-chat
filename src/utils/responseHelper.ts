import { Response } from 'express';
import { ApiResponse } from '../types/friends';

/**
 * Helper for creating standard API responses
 */
export class ResponseHelper {
	/**
	 * Creates a success response
	 */
	static success<T>(res: Response, message: string, data?: T, statusCode: number = 200): void {
		const response: ApiResponse<T> = {
			success: true,
			message,
			...(data && { data }),
		};

		res.status(statusCode).json(response);
	}

	/**
	 * Creates an error response
	 */
	static error(
		res: Response,
		message: string,
		statusCode: number = 400,
		errors?: Array<{ field: string; message: string }>,
	): void {
		const response: ApiResponse = {
			success: false,
			message,
			...(errors && { errors }),
		};

		res.status(statusCode).json(response);
	}

	/**
	 * Creates a validation error response
	 */
	static validationError(res: Response, errors: Array<{ field: string; message: string }>): void {
		this.error(res, 'Invalid data', 400, errors);
	}

	/**
	 * Creates an unauthorized error response
	 */
	static unauthorized(res: Response, message: string = 'User authorization required'): void {
		this.error(res, message, 401);
	}

	/**
	 * Creates a forbidden error response
	 */
	static forbidden(res: Response, message: string = 'Insufficient permissions'): void {
		this.error(res, message, 403);
	}

	/**
	 * Creates a not found error response
	 */
	static notFound(res: Response, message: string = 'Not found'): void {
		this.error(res, message, 404);
	}

	/**
	 * Creates a server error response
	 */
	static serverError(res: Response, message: string = 'Server error'): void {
		this.error(res, message, 500);
	}
}
