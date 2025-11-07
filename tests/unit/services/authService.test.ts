import {
	registerUser,
	loginUser,
	getUserData,
	changePassword,
} from '../../../src/services/authService';
import { AuthServiceError } from '../../../src/types/auth';
import bcrypt from 'bcrypt';

// Mock Prisma Client - define everything inline to avoid hoisting issues
const mockPrismaMethods = {
	user: {
		findFirst: jest.fn(),
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	},
	refreshToken: {
		create: jest.fn(),
		findUnique: jest.fn(),
		deleteMany: jest.fn(),
	},
	$disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => {
	// Define mock methods directly in the factory function
	const mockUser = {
		findFirst: jest.fn(),
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	};
	const mockRefreshToken = {
		create: jest.fn(),
		findUnique: jest.fn(),
		deleteMany: jest.fn(),
	};

	// Store reference globally so we can access it in tests
	(global as any).__mockPrismaInstance = {
		user: mockUser,
		refreshToken: mockRefreshToken,
		$disconnect: jest.fn(),
	};

	return {
		PrismaClient: jest.fn(() => (global as any).__mockPrismaInstance),
	};
});

// Get reference to the mock instance
const getMockPrisma = () => (global as any).__mockPrismaInstance;

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService - Unit Tests', () => {
	const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('registerUser', () => {
		it('should register a new user successfully', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
			(mockPrisma.user.create as jest.Mock).mockResolvedValue({
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
				password: 'hashed',
			});
			(mockBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

			await expect(
				registerUser({
					email: 'test@example.com',
					username: 'testuser',
					password: 'password123',
				}),
			).resolves.not.toThrow();

			expect(mockPrisma.user.findFirst).toHaveBeenCalled();
			expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
			expect(mockPrisma.user.create).toHaveBeenCalled();
		});

		it('should throw error if user already exists', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			});

			await expect(
				registerUser({
					email: 'test@example.com',
					username: 'testuser',
					password: 'password123',
				}),
			).rejects.toThrow(AuthServiceError);
		});
	});

	describe('loginUser', () => {
		it('should throw error with invalid credentials when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(AuthServiceError);
		});

		it('should throw error when account is deleted', async () => {
			const mockPrisma = getMockPrisma();
			const mockUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
				password: '$2b$12$hashedpassword',
				deletedAt: new Date(),
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

			await expect(loginUser('test@example.com', 'password123')).rejects.toThrow(AuthServiceError);
		});

		it('should throw error with invalid password', async () => {
			const mockPrisma = getMockPrisma();
			const mockUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
				password: '$2b$12$hashedpassword',
				deletedAt: null,
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
			(mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

			await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(AuthServiceError);
		});
	});

	describe('getUserData', () => {
		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(getUserData('non-existent-id')).rejects.toThrow(AuthServiceError);
		});

		it('should throw error when account is deleted', async () => {
			const mockPrisma = getMockPrisma();
			const mockUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
				createdAt: new Date(),
				lastSeen: null,
				deletedAt: new Date(),
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

			await expect(getUserData('1')).rejects.toThrow(AuthServiceError);
		});
	});

	describe('changePassword', () => {
		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(changePassword('non-existent-id', 'oldpass', 'newpass')).rejects.toThrow(
				AuthServiceError,
			);
		});

		it('should throw error when current password is incorrect', async () => {
			const mockPrisma = getMockPrisma();
			const mockUser = {
				id: '1',
				password: '$2b$12$hashedpassword',
				deletedAt: null,
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
			(mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

			await expect(changePassword('1', 'wrongpassword', 'newpassword')).rejects.toThrow(
				AuthServiceError,
			);
		});
	});
});
