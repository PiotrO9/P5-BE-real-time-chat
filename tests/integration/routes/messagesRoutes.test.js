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
describe('Messages Routes - Integration Tests', () => {
    let user1;
    let user2;
    let chatId;
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
        chatId = chat.id;
    });
    describe('GET /api/messages/:chatId/messages', () => {
        it('should return empty messages list for new chat', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get(`/api/messages/${chatId}/messages`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.messages).toEqual([]);
            expect(response.body.data.total).toBe(0);
        });
        it('should return 404 when chat not found or user is not member', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .get('/api/messages/non-existent-id/messages')
                .set(headers)
                .expect(404);
            expect(response.body.success).toBe(false);
        });
        it('should return 401 when not authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .get(`/api/messages/${chatId}/messages`)
                .expect(401);
            expect(response.body.success).toBe(false);
        });
    });
    describe('POST /api/messages/:chatId/messages', () => {
        it('should send message successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${chatId}/messages`)
                .set(headers)
                .send({
                content: 'Hello, this is a test message!',
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('Hello, this is a test message!');
            expect(response.body.data.senderId).toBe(user1.id);
        });
        it('should send message with reply', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const firstMessage = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user1.id,
                    content: 'First message',
                    createdBy: user1.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${chatId}/messages`)
                .set(headers)
                .send({
                content: 'Reply message',
                replyToId: firstMessage.id,
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.replyTo).toBeDefined();
            expect(response.body.data.replyTo.id).toBe(firstMessage.id);
        });
        it('should return error when content is empty', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${chatId}/messages`)
                .set(headers)
                .send({
                content: '',
            })
                .expect(400);
            expect(response.body.success).toBe(false);
        });
        it('should return 401 when not authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${chatId}/messages`)
                .send({
                content: 'Test message',
            })
                .expect(401);
            expect(response.body.success).toBe(false);
        });
    });
    describe('PATCH /api/messages/:messageId', () => {
        it('should edit message successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user1.id,
                    content: 'Original message',
                    createdBy: user1.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/messages/${message.id}`)
                .set(headers)
                .send({
                content: 'Edited message',
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('Edited message');
            expect(response.body.data.wasUpdated).toBe(true);
        });
        it('should return error when trying to edit another user message', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user2.id,
                    content: 'User2 message',
                    createdBy: user2.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .patch(`/api/messages/${message.id}`)
                .set(headers)
                .send({
                content: 'Trying to edit',
            })
                .expect(403);
            expect(response.body.success).toBe(false);
        });
    });
    describe('DELETE /api/messages/:messageId', () => {
        it('should delete message successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user1.id,
                    content: 'Message to delete',
                    createdBy: user1.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/messages/${message.id}`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
        });
        it('should return error when trying to delete another user message', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user2.id,
                    content: 'User2 message',
                    createdBy: user2.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .delete(`/api/messages/${message.id}`)
                .set(headers)
                .expect(403);
            expect(response.body.success).toBe(false);
        });
    });
    describe('POST /api/messages/:messageId/reactions', () => {
        it('should add reaction to message successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user1.id, user1.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user1.id,
                    content: 'Test message',
                    createdBy: user1.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${message.id}/reactions`)
                .set(headers)
                .send({
                emoji: '👍',
            })
                .expect(200);
            expect(response.body.success).toBe(true);
        });
    });
    describe('POST /api/messages/:messageId/read', () => {
        it('should mark message as read successfully', async () => {
            const headers = (0, testHelpers_1.createAuthHeaders)(user2.id, user2.email);
            const message = await testSetup_1.prisma.message.create({
                data: {
                    chatId,
                    senderId: user1.id,
                    content: 'Test message',
                    createdBy: user1.id,
                },
            });
            const response = await (0, supertest_1.default)(app_1.app)
                .post(`/api/messages/${message.id}/read`)
                .set(headers)
                .expect(200);
            expect(response.body.success).toBe(true);
        });
    });
});
//# sourceMappingURL=messagesRoutes.test.js.map