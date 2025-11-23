"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userService_1 = require("../../../src/services/userService");
const user_1 = require("../../../src/types/user");
const bcrypt_1 = __importDefault(require("bcrypt"));
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
    global.__mockPrismaInstance = {
        user: mockUser,
        $disconnect: jest.fn(),
    };
    return {
        PrismaClient: jest.fn(() => global.__mockPrismaInstance),
    };
});
const getMockPrisma = () => global.__mockPrismaInstance;
jest.mock('bcrypt');
describe('UserService - Unit Tests', () => {
    let userService;
    const mockBcrypt = bcrypt_1.default;
    beforeEach(() => {
        jest.clearAllMocks();
        userService = new userService_1.UserService();
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
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
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
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(userService.getUserProfile('non-existent')).rejects.toThrow(user_1.UserServiceError);
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
            mockPrisma.user.findMany.mockResolvedValue(mockUsers);
            mockPrisma.user.count.mockResolvedValue(2);
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
            mockPrisma.user.findMany.mockResolvedValue([]);
            mockPrisma.user.count.mockResolvedValue(50);
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
            mockPrisma.user.findUnique.mockResolvedValue({
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
            });
            await expect(userService.updateUserProfile('1', {})).rejects.toThrow(user_1.UserServiceError);
            await expect(userService.updateUserProfile('1', {})).rejects.toThrow('At least one field (username or email) is required');
        });
        it('should throw error when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(userService.updateUserProfile('non-existent', { username: 'newusername' })).rejects.toThrow(user_1.UserServiceError);
        });
        it('should throw error when email already in use', async () => {
            const mockPrisma = getMockPrisma();
            const existingUser = {
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
            };
            mockPrisma.user.findUnique
                .mockResolvedValueOnce(existingUser)
                .mockResolvedValueOnce({ id: '2', email: 'newemail@example.com' });
            await expect(userService.updateUserProfile('1', { email: 'newemail@example.com' })).rejects.toThrow(user_1.UserServiceError);
            await expect(userService.updateUserProfile('1', { email: 'newemail@example.com' })).rejects.toThrow('Email already in use');
        });
        it('should throw error when username already in use', async () => {
            const mockPrisma = getMockPrisma();
            const existingUser = {
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
            };
            mockPrisma.user.findUnique
                .mockResolvedValueOnce(existingUser)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: '2', username: 'newusername' });
            await expect(userService.updateUserProfile('1', { username: 'newusername' })).rejects.toThrow(user_1.UserServiceError);
            await expect(userService.updateUserProfile('1', { username: 'newusername' })).rejects.toThrow('Username already in use');
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
            mockPrisma.user.findUnique
                .mockResolvedValueOnce(existingUser)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
            mockPrisma.user.update.mockResolvedValue(updatedUser);
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
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(userService.deleteUser('non-existent')).rejects.toThrow(user_1.UserServiceError);
        });
        it('should soft delete user successfully', async () => {
            const mockPrisma = getMockPrisma();
            const existingUser = {
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
            };
            mockPrisma.user.findUnique.mockResolvedValue(existingUser);
            mockPrisma.user.update.mockResolvedValue({
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
            mockPrisma.user.findUnique.mockResolvedValue({
                isOnline: true,
            });
            const result = await userService.getUserStatus('1');
            expect(result.status).toBe('online');
        });
        it('should return offline status', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue({
                isOnline: false,
            });
            const result = await userService.getUserStatus('1');
            expect(result.status).toBe('offline');
        });
        it('should throw error when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(userService.getUserStatus('non-existent')).rejects.toThrow(user_1.UserServiceError);
        });
    });
    describe('updateUserPassword', () => {
        it('should throw error when new password is same as current', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue({
                id: '1',
                password: 'hashedpassword',
            });
            await expect(userService.updateUserPassword('1', {
                currentPassword: 'password123',
                newPassword: 'password123',
            })).rejects.toThrow(user_1.UserServiceError);
            await expect(userService.updateUserPassword('1', {
                currentPassword: 'password123',
                newPassword: 'password123',
            })).rejects.toThrow('New password must be different from current password');
        });
        it('should throw error when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect(userService.updateUserPassword('non-existent', {
                currentPassword: 'oldpass',
                newPassword: 'newpass',
            })).rejects.toThrow(user_1.UserServiceError);
        });
        it('should throw error when current password is incorrect', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue({
                id: '1',
                password: 'hashedpassword',
            });
            mockBcrypt.compare.mockResolvedValue(false);
            await expect(userService.updateUserPassword('1', {
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword',
            })).rejects.toThrow(user_1.UserServiceError);
            await expect(userService.updateUserPassword('1', {
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword',
            })).rejects.toThrow('Current password is incorrect');
        });
        it('should update password successfully', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue({
                id: '1',
                password: 'hashedpassword',
            });
            mockBcrypt.compare.mockResolvedValue(true);
            mockBcrypt.hash.mockResolvedValue('newhashedpassword');
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
            mockPrisma.user.update.mockResolvedValue({
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
            mockPrisma.user.update.mockResolvedValue({
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
//# sourceMappingURL=userService.test.js.map