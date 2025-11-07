import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../../src/middleware/errorHandler';

describe('Error Handler Middleware - Unit Tests', () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		mockRequest = {
			originalUrl: '/api/test',
		};
		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};
		mockNext = jest.fn();
	});

	describe('errorHandler', () => {
		it('should handle Prisma duplicate entry error (P2002)', () => {
			const error = {
				code: 'P2002',
				meta: { target: ['email'] },
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(400);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Duplicate entry - this resource already exists',
				field: ['email'],
			});
		});

		it('should handle Prisma record not found error (P2025)', () => {
			const error = {
				code: 'P2025',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(404);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Resource not found',
			});
		});

		it('should handle JsonWebTokenError', () => {
			const error = {
				name: 'JsonWebTokenError',
				message: 'Invalid token',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(401);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Invalid token',
			});
		});

		it('should handle TokenExpiredError', () => {
			const error = {
				name: 'TokenExpiredError',
				message: 'Token expired',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(401);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Token expired',
			});
		});

		it('should handle generic error with status code', () => {
			const error = {
				status: 400,
				message: 'Bad request',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(400);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Bad request',
			});
		});

		it('should handle generic error without status code (defaults to 500)', () => {
			const error = {
				message: 'Internal server error',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(500);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Internal server error',
			});
		});

		it('should include stack trace in development mode', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			const error = {
				message: 'Test error',
				stack: 'Error stack trace',
			};

			errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Test error',
				stack: 'Error stack trace',
			});

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe('notFoundHandler', () => {
		it('should return 404 with route not found message', () => {
			mockRequest.originalUrl = '/api/nonexistent';

			notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(404);
			expect(mockResponse.json).toHaveBeenCalledWith({
				error: 'Route /api/nonexistent not found',
			});
		});
	});
});

