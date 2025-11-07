import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, TokenPayload } from '../../src/utils/jwt';

const prisma = new PrismaClient({
	datasources: {
		db: {
			url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
		},
	},
});

export interface TestUser {
	id: string;
	email: string;
	username: string;
	password: string;
}

/**
 * Create a test user in database
 */
export async function createTestUser(data?: {
	email?: string;
	username?: string;
	password?: string;
}): Promise<TestUser> {
	const email = data?.email || `test${Date.now()}@example.com`;
	const username = data?.username || `testuser${Date.now()}`;
	const password = data?.password || 'password123';

	const hashedPassword = await bcrypt.hash(password, 12);

	const user = await prisma.user.create({
		data: {
			email,
			username,
			password: hashedPassword,
		},
	});

	return {
		id: user.id,
		email: user.email,
		username: user.username,
		password, // Return plain password for testing
	};
}

/**
 * Generate test JWT token
 */
export function generateTestToken(payload: TokenPayload): string {
	return generateAccessToken(payload);
}

/**
 * Create authenticated request headers
 */
export function createAuthHeaders(userId: string, email: string): { Cookie: string } {
	const token = generateTestToken({ userId, email });
	return {
		Cookie: `accessToken=${token}`,
	};
}
