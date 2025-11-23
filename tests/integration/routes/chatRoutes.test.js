"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../../src/app");
const testDatabase_1 = require("../../setup/testDatabase");
const testHelpers_1 = require("../../helpers/testHelpers");
const testSetup_1 = require("../../setup/testSetup");
const client_1 = require("@prisma/client");
jest.mock('../../../src/socket/socketHandlers', () => ({
    initializeSocketHandlers: jest.fn(),
}));
jest.mock('../../../src/socket/socketEmitters', () => ({
    initializeSocketEmitters: jest.fn(),
    emitUserStatusChange: jest.fn(),
}));
describe('Chat Routes - Integration Tests', () => {
    let user1;
    let user2;
    beforeEach(async () => {
        await (0, testDatabase_1.cleanDatabase)();
        user1 = await (0, testHelpers_1.createTestUser)({
            email: 'user1@example.com',
            username: 'user1',
            password: 'password123',
        });
        user2 = await (0, testHelpers_1.createTestUser)({
            email: 'user2@example.com',
            username: 'user2',
            password: 'password123',
        });
        await testSetup_1.prisma.friendship.create({
            data: {
                requesterId: user1.id,
                addresseeId: user2.id,
                createdBy: user1.id,
            },
        });
    });
    describe('GET /api/chats', () => {
        it('should return empty chats list for new user', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get('/api/chats')
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.chats).toEqual([]);
            expect(response.body.data.total).toBe(0);
        });
        it('should return 401 when not authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.app).get('/api/chats').expect(401);
            expect(response.body.success).toBe(false);
        });
    });
    describe('POST /api/chats', () => {
        it('should create 1-on-1 chat successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/chats')
                .set(headers)
                .send({
                participantId: user2.id,
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.isGroup).toBe(false);
            expect(response.body.data.otherUser).toBeDefined();
            expect(response.body.data.otherUser.id).toBe(user2.id);
        });
        it('should return error when trying to create chat with yourself', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/chats')
                .set(headers)
                .send({
                participantId: user1.id,
            })
                .expect(400);
            expect(response.body.success).toBe(false);
        });
        it('should return error when users are not friends', async () => {
            const user3 = await (0, testHelpers_1.createTestUser)({
                email: 'user3@example.com',
                username: 'user3',
                password: 'password123',
            });
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/chats')
                .set(headers)
                .send({
                participantId: user3.id,
            })
                .expect(400);
            expect(response.body.success).toBe(false);
        });
        it('should create group chat successfully', async () => {
            const user3 = await (0, testHelpers_1.createTestUser)({
                email: 'user3@example.com',
                username: 'user3',
                password: 'password123',
            });
            await testSetup_1.prisma.friendship.create({
                data: {
                    requesterId: user1.id,
                    addresseeId: user3.id,
                    createdBy: user1.id,
                },
            });
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/chats')
                .set(headers)
                .send({
                name: 'Test Group',
                participantIds: [user2.id, user3.id],
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.isGroup).toBe(true);
            expect(response.body.data.name).toBe('Test Group');
            expect(response.body.data.members).toBeDefined();
            expect(response.body.data.memberCount).toBeGreaterThanOrEqual(3);
        });
        it('should return 401 when not authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post('/api/chats')
                .send({
                participantId: user2.id,
            })
                .expect(401);
            expect(response.body.success).toBe(false);
        });
    });
    describe('GET /api/chats/:id', () => {
        it('should return chat details when user is member', async () => {
            const chat = await testSetup_1.prisma.chat.create({
                data: {
                    isGroup: false,
                    createdBy: user1.id,
                    chatUsers: {
                        create: [
                            {
                                userId: user1.id,
                                role: client_1.ChatRole.USER,
                                createdBy: user1.id,
                            },
                            {
                                userId: user2.id,
                                role: client_1.ChatRole.USER,
                                createdBy: user1.id,
                            },
                        ],
                    },
                },
            });
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get(`/api/chats/${chat.id}`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(chat.id);
        });
        it('should return 404 when chat not found or user is not member', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get('/api/chats/non-existent-id')
                .set(headers)
                .expect(404);
            expect(response.body.success).toBe(false);
        });
    });
    describe('DELETE /api/chats/:id', () => {
        it('should delete 1-on-1 chat successfully', async () => {
            const chat = await testSetup_1.prisma.chat.create({
                data: {
                    isGroup: false,
                    createdBy: user1.id,
                    chatUsers: {
                        create: [
                            {
                                userId: user1.id,
                                role: client_1.ChatRole.USER,
                                createdBy: user1.id,
                            },
                            {
                                userId: user2.id,
                                role: client_1.ChatRole.USER,
                                createdBy: user1.id,
                            },
                        ],
                    },
                },
            });
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/chats/${chat.id}`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
        });
        it('should delete group chat when user is owner', async () => {
            const chat = await testSetup_1.prisma.chat.create({
                data: {
                    isGroup: true,
                    name: 'Test Group',
                    createdBy: user1.id,
                    chatUsers: {
                        create: [
                            {
                                userId: user1.id,
                                role: client_1.ChatRole.OWNER,
                                createdBy: user1.id,
                            },
                            {
                                userId: user2.id,
                                role: client_1.ChatRole.USER,
                                createdBy: user1.id,
                            },
                        ],
                    },
                },
            });
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/chats/${chat.id}`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
        });
    });
});
//# sourceMappingURL=chatRoutes.test.js.map