"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../../src/app");
const testDatabase_1 = require("../../setup/testDatabase");
const testHelpers_1 = require("../../helpers/testHelpers");
jest.mock('../../../src/socket/socketHandlers', () => ({
    initializeSocketHandlers: jest.fn(),
}));
jest.mock('../../../src/socket/socketEmitters', () => ({
    initializeSocketEmitters: jest.fn(),
    emitUserStatusChange: jest.fn(),
}));
describe('Auth Routes - Integration Tests', () => {
    beforeEach(async () => {
        await (0, testDatabase_1.cleanDatabase)();
    });
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/auth/register')
                .send({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User registered successfully');
        });
        it('should return validation error for invalid data', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/auth/register')
                .send({
                email: 'invalid-email',
                username: 'ab',
                password: '123',
            })
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation failed');
            expect(response.body.details).toBeDefined();
        });
        it('should return error if user already exists', async () => {
            await (0, testHelpers_1.createTestUser)({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/auth/register')
                .send({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            })
                .expect(409);
            expect(response.body.success).toBe(false);
        });
    });
    describe('POST /api/auth/login', () => {
        let testUser;
        beforeEach(async () => {
            testUser = await (0, testHelpers_1.createTestUser)({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            });
        });
        it('should login user with valid credentials', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/auth/login')
                .send({
                email: 'test@example.com',
                password: 'password123',
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data.user.email).toBe('test@example.com');
            expect(response.headers['set-cookie']).toBeDefined();
        });
        it('should return error with invalid credentials', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/auth/login')
                .send({
                email: 'test@example.com',
                password: 'wrongpassword',
            })
                .expect(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid credentials');
        });
    });
    describe('GET /api/auth/me', () => {
        let testUser;
        beforeEach(async () => {
            testUser = await (0, testHelpers_1.createTestUser)({
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
            });
        });
        it('should return user data when authenticated', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(testUser.id, testUser.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get('/api/auth/me')
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.id).toBe(testUser.id);
            expect(response.body.data.user.email).toBe(testUser.email);
        });
        it('should return 401 when not authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .get('/api/auth/me')
                .expect(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access token required');
        });
    });
});
//# sourceMappingURL=authRoutes.test.js.map