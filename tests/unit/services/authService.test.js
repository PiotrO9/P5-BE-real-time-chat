"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authService_1 = require("../../../src/services/authService");
const auth_1 = require("../../../src/types/auth");
const bcrypt_1 = __importDefault(require("bcrypt"));
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
    global.__mockPrismaInstance = {
        user: mockUser,
        refreshToken: mockRefreshToken,
        $disconnect: jest.fn(),
    };
    return {
        PrismaClient: jest.fn(() => global.__mockPrismaInstance),
    };
});
const getMockPrisma = () => global.__mockPrismaInstance;
jest.mock('bcrypt');
describe('AuthService - Unit Tests', () => {
    const mockBcrypt = bcrypt_1.default;
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('registerUser', () => {
        it('should register a new user successfully', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findFirst.mockResolvedValue(null);
            mockPrisma.user.create.mockResolvedValue({
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashed',
            });
            mockBcrypt.hash.mockResolvedValue('hashedpassword');
            await expect((0, authService_1.registerUser)({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            })).resolves.not.toThrow();
            expect(mockPrisma.user.findFirst).toHaveBeenCalled();
            expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
            expect(mockPrisma.user.create).toHaveBeenCalled();
        });
        it('should throw error if user already exists', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findFirst.mockResolvedValue({
                id: '1',
                email: 'test@example.com',
                username: 'testuser',
            });
            await expect((0, authService_1.registerUser)({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            })).rejects.toThrow(auth_1.AuthServiceError);
        });
    });
    describe('loginUser', () => {
        it('should throw error with invalid credentials when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, authService_1.loginUser)('test@example.com', 'wrongpassword')).rejects.toThrow(auth_1.AuthServiceError);
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
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            await expect((0, authService_1.loginUser)('test@example.com', 'password123')).rejects.toThrow(auth_1.AuthServiceError);
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
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockBcrypt.compare.mockResolvedValue(false);
            await expect((0, authService_1.loginUser)('test@example.com', 'wrongpassword')).rejects.toThrow(auth_1.AuthServiceError);
        });
    });
    describe('getUserData', () => {
        it('should throw error when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, authService_1.getUserData)('non-existent-id')).rejects.toThrow(auth_1.AuthServiceError);
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
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            await expect((0, authService_1.getUserData)('1')).rejects.toThrow(auth_1.AuthServiceError);
        });
    });
    describe('changePassword', () => {
        it('should throw error when user not found', async () => {
            const mockPrisma = getMockPrisma();
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, authService_1.changePassword)('non-existent-id', 'oldpass', 'newpass')).rejects.toThrow(auth_1.AuthServiceError);
        });
        it('should throw error when current password is incorrect', async () => {
            const mockPrisma = getMockPrisma();
            const mockUser = {
                id: '1',
                password: '$2b$12$hashedpassword',
                deletedAt: null,
            };
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockBcrypt.compare.mockResolvedValue(false);
            await expect((0, authService_1.changePassword)('1', 'wrongpassword', 'newpassword')).rejects.toThrow(auth_1.AuthServiceError);
        });
    });
});
//# sourceMappingURL=authService.test.js.map