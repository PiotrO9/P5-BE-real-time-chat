/// <reference types="jest" />
import { PrismaClient } from '@prisma/client';

// Global Prisma instance for tests
export const prisma = new PrismaClient({
	datasources: {
		db: {
			url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
		},
	},
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret-key';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-key';

// Ensure database is ready before tests
beforeAll(async () => {
	try {
		// Try to connect to database to ensure it's ready
		await prisma.$connect();
		// Try a simple query to ensure schema exists
		await prisma.$queryRaw`SELECT 1`;
	} catch (error) {
		console.warn('Database connection warning:', error);
		// Database might not be ready yet, but tests will handle it
	}
});

// Cleanup after all tests
afterAll(async () => {
	await prisma.$disconnect();
});
