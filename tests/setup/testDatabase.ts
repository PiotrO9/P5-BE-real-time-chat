import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
	datasources: {
		db: {
			url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
		},
	},
});

/**
 * Clean database before each test
 * Handles cases where tables might not exist yet
 */
export async function cleanDatabase(): Promise<void> {
	try {
		// Delete in order to respect foreign key constraints
		// Use try-catch for each operation in case tables don't exist
		await prisma.messageReaction.deleteMany().catch(() => {});
		await prisma.messageRead.deleteMany().catch(() => {});
		await prisma.message.deleteMany().catch(() => {});
		await prisma.chatUser.deleteMany().catch(() => {});
		await prisma.chat.deleteMany().catch(() => {});
		await prisma.friendInvite.deleteMany().catch(() => {});
		await prisma.friendship.deleteMany().catch(() => {});
		await prisma.refreshToken.deleteMany().catch(() => {});
		await prisma.user.deleteMany().catch(() => {});
	} catch (error) {
		// Ignore errors if tables don't exist - they will be created by migrations
		console.warn('Warning: Some tables may not exist yet:', error);
	}
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
	await prisma.$disconnect();
}
