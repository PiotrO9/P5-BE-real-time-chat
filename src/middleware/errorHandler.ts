import { Request, Response, NextFunction } from 'express';

// Global middleware for error handling
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
	console.error('Error:', error);

	if (error.code === 'P2002') {
		res.status(400).json({
			error: 'Duplicate entry - this resource already exists',
			field: error.meta?.target || 'unknown',
		});
		return;
	}

	if (error.code === 'P2025') {
		res.status(404).json({
			error: 'Resource not found',
		});
		return;
	}

	if (error.name === 'JsonWebTokenError') {
		res.status(401).json({
			error: 'Invalid token',
		});
		return;
	}

	if (error.name === 'TokenExpiredError') {
		res.status(401).json({
			error: 'Token expired',
		});
		return;
	}

	res.status(error.status || 500).json({
		error: error.message || 'Internal server error',
		...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
	});
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
	res.status(404).json({
		error: `Route ${req.originalUrl} not found`,
	});
};
