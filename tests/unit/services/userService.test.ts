import { UserService } from '../../../src/services/userService';
import { UserServiceError } from '../../../src/types/user';
import bcrypt from 'bcrypt';

// Mock Prisma Client
const mockPrismaMethods = {
	user: {
		findUnique: jest.fn(),
		findMany: jest.fn(),
		count: jest.fn(),
		update: jest.fn(),
	},
	$disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => {
	const mockUser = {
		findUnique: jest.fn(),
		findMany: jest.fn(),
		count: jest.fn(),
		update: jest.fn(),
	};

	(global as any).__mockPrismaInstance = {
		user: mockUser,
		$disconnect: jest.fn(),
	};

	return {
		PrismaClient: jest.fn(() => (global as any).__mockPrismaInstance),
	};
});

const getMockPrisma = () => (global as any).__mockPrismaInstance;

// Mock bcrypt
jest.mock('bcrypt');

describe('UserService - Unit Tests', () => {
	let userService: UserService;
	const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

	beforeEach(() => {
		jest.clearAllMocks();
		userService = new UserService();
	});

	describe('getUserProfile', () => {
		it('should return user profile when user exists', async () => {
			const mockPrisma = getMockPrisma();
			const mockUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
				createdAt: new Date(),
				updatedAt: new Date(),
				lastSeen: null,
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

			const result = await userService.getUserProfile('1');

			expect(result).toEqual(mockUser);
			expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
				where: { id: '1' },
				select: {
					id: true,
					email: true,
					username: true,
					createdAt: true,
					updatedAt: true,
					lastSeen: true,
				},
			});
		});

		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(userService.getUserProfile('non-existent')).rejects.toThrow(UserServiceError);
			await expect(userService.getUserProfile('non-existent')).rejects.toThrow('User not found');
		});
	});

	describe('getAllUsers', () => {
		it('should return paginated users', async () => {
			const mockPrisma = getMockPrisma();
			const mockUsers = [
				{
					id: '1',
					email: 'test1@example.com',
					username: 'testuser1',
					createdAt: new Date(),
					lastSeen: null,
				},
				{
					id: '2',
					email: 'test2@example.com',
					username: 'testuser2',
					createdAt: new Date(),
					lastSeen: null,
				},
			];

			(mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
			(mockPrisma.user.count as jest.Mock).mockResolvedValue(2);

			const result = await userService.getAllUsers({ page: 1, limit: 20 });

			expect(result.users).toEqual(mockUsers);
			expect(result.pagination.currentPage).toBe(1);
			expect(result.pagination.totalPages).toBe(1);
			expect(result.pagination.totalUsers).toBe(2);
			expect(result.pagination.hasNext).toBe(false);
			expect(result.pagination.hasPrev).toBe(false);
		});

		it('should handle pagination correctly', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrisma.user.count as jest.Mock).mockResolvedValue(50);

			const result = await userService.getAllUsers({ page: 2, limit: 20 });

			expect(result.pagination.currentPage).toBe(2);
			expect(result.pagination.totalPages).toBe(3);
			expect(result.pagination.totalUsers).toBe(50);
			expect(result.pagination.hasNext).toBe(true);
			expect(result.pagination.hasPrev).toBe(true);
			expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
				select: {
					id: true,
					email: true,
					username: true,
					createdAt: true,
					lastSeen: true,
				},
				skip: 20,
				take: 20,
				orderBy: {
					createdAt: 'desc',
				},
			});
		});
	});

	describe('updateUserProfile', () => {
		it('should throw error when no fields provided', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			});

			await expect(userService.updateUserProfile('1', {})).rejects.toThrow(UserServiceError);
			await expect(userService.updateUserProfile('1', {})).rejects.toThrow(
				'At least one field (username or email) is required',
			);
		});

		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(
				userService.updateUserProfile('non-existent', { username: 'newusername' }),
			).rejects.toThrow(UserServiceError);
		});

		it('should throw error when email already in use', async () => {
			const mockPrisma = getMockPrisma();
			const existingUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			};

			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce(existingUser) // First call for existing user check
				.mockResolvedValueOnce({ id: '2', email: 'newemail@example.com' }); // Second call for email check

			await expect(
				userService.updateUserProfile('1', { email: 'newemail@example.com' }),
			).rejects.toThrow(UserServiceError);
			await expect(
				userService.updateUserProfile('1', { email: 'newemail@example.com' }),
			).rejects.toThrow('Email already in use');
		});

		it('should throw error when username already in use', async () => {
			const mockPrisma = getMockPrisma();
			const existingUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			};

			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce(existingUser) // First call for existing user check
				.mockResolvedValueOnce(null) // Email check passes
				.mockResolvedValueOnce({ id: '2', username: 'newusername' }); // Username check fails

			await expect(
				userService.updateUserProfile('1', { username: 'newusername' }),
			).rejects.toThrow(UserServiceError);
			await expect(
				userService.updateUserProfile('1', { username: 'newusername' }),
			).rejects.toThrow('Username already in use');
		});

		it('should update user profile successfully', async () => {
			const mockPrisma = getMockPrisma();
			const existingUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			};
			const updatedUser = {
				id: '1',
				email: 'newemail@example.com',
				username: 'newusername',
				createdAt: new Date(),
				updatedAt: new Date(),
				lastSeen: null,
			};

			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce(existingUser) // Existing user check
				.mockResolvedValueOnce(null) // Email check
				.mockResolvedValueOnce(null); // Username check
			(mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

			const result = await userService.updateUserProfile('1', {
				email: 'newemail@example.com',
				username: 'newusername',
			});

			expect(result).toEqual(updatedUser);
			expect(mockPrisma.user.update).toHaveBeenCalled();
		});
	});

	describe('deleteUser', () => {
		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(userService.deleteUser('non-existent')).rejects.toThrow(UserServiceError);
		});

		it('should soft delete user successfully', async () => {
			const mockPrisma = getMockPrisma();
			const existingUser = {
				id: '1',
				email: 'test@example.com',
				username: 'testuser',
			};

			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
			(mockPrisma.user.update as jest.Mock).mockResolvedValue({
				...existingUser,
				deletedAt: new Date(),
			});

			await userService.deleteUser('1');

			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: '1' },
				data: {
					deletedAt: expect.any(Date),
				},
			});
		});
	});

	describe('getUserStatus', () => {
		it('should return online status', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				isOnline: true,
			});

			const result = await userService.getUserStatus('1');

			expect(result.status).toBe('online');
		});

		it('should return offline status', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				isOnline: false,
			});

			const result = await userService.getUserStatus('1');

			expect(result.status).toBe('offline');
		});

		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(userService.getUserStatus('non-existent')).rejects.toThrow(UserServiceError);
		});
	});

	describe('updateUserPassword', () => {
		it('should throw error when new password is same as current', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				id: '1',
				password: 'hashedpassword',
			});

			await expect(
				userService.updateUserPassword('1', {
					currentPassword: 'password123',
					newPassword: 'password123',
				}),
			).rejects.toThrow(UserServiceError);
			await expect(
				userService.updateUserPassword('1', {
					currentPassword: 'password123',
					newPassword: 'password123',
				}),
			).rejects.toThrow('New password must be different from current password');
		});

		it('should throw error when user not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(
				userService.updateUserPassword('non-existent', {
					currentPassword: 'oldpass',
					newPassword: 'newpass',
				}),
			).rejects.toThrow(UserServiceError);
		});

		it('should throw error when current password is incorrect', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				id: '1',
				password: 'hashedpassword',
			});
			(mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

			await expect(
				userService.updateUserPassword('1', {
					currentPassword: 'wrongpassword',
					newPassword: 'newpassword',
				}),
			).rejects.toThrow(UserServiceError);
			await expect(
				userService.updateUserPassword('1', {
					currentPassword: 'wrongpassword',
					newPassword: 'newpassword',
				}),
			).rejects.toThrow('Current password is incorrect');
		});

		it('should update password successfully', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				id: '1',
				password: 'hashedpassword',
			});
			(mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
			(mockBcrypt.hash as jest.Mock).mockResolvedValue('newhashedpassword');

			await userService.updateUserPassword('1', {
				currentPassword: 'oldpassword',
				newPassword: 'newpassword',
			});

			expect(mockBcrypt.compare).toHaveBeenCalledWith('oldpassword', 'hashedpassword');
			expect(mockBcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: '1' },
				data: { password: 'newhashedpassword' },
			});
		});
	});

	describe('setUserOnline', () => {
		it('should set user online', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.update as jest.Mock).mockResolvedValue({
				id: '1',
				isOnline: true,
				lastSeen: new Date(),
			});

			await userService.setUserOnline('1');

			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: '1' },
				data: {
					isOnline: true,
					lastSeen: expect.any(Date),
				},
			});
		});
	});

	describe('setUserOffline', () => {
		it('should set user offline', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.update as jest.Mock).mockResolvedValue({
				id: '1',
				isOnline: false,
				lastSeen: new Date(),
			});

			await userService.setUserOffline('1');

			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: '1' },
				data: {
					isOnline: false,
					lastSeen: expect.any(Date),
				},
			});
		});
	});
});

