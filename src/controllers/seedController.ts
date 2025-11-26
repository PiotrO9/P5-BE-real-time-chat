import { Request, Response, NextFunction } from 'express';
import { SeedService } from '../services/seedService';

const seedService = new SeedService();

/**
 * Seed database with sample data
 * POST /api/seed
 */
export async function seedDatabase(req: Request, res: Response, next: NextFunction) {
	try {
		const result = await seedService.seedDatabase();

		return res.status(201).json({
			message: 'Database seeded successfully',
			data: {
				...result.statistics,
				usersList: result.users,
				defaultPassword: result.defaultPassword,
				note: `All users have password: ${result.defaultPassword}`,
			},
		});
	} catch (error) {
		next(error);
		return;
	}
}

/**
 * Clear seeded data from database
 * DELETE /api/seed
 */
export async function clearSeededData(req: Request, res: Response, next: NextFunction) {
	try {
		await seedService.clearSeededData();

		return res.status(200).json({
			message: 'Seeded data cleared successfully',
		});
	} catch (error) {
		next(error);
		return;
	}
}

