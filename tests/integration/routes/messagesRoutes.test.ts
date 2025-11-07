import request from 'supertest';
import { app } from '../../../src/app';
import { cleanDatabase } from '../../setup/testDatabase';
import { createTestUser, createAuthHeaders } from '../../helpers/testHelpers';
import { prisma } from '../../setup/testSetup';
import { ChatRole } from '@prisma/client';

// Mock socket.io to prevent server initialization in tests
jest.mock('../../../src/socket/socketHandlers', () => ({
	initializeSocketHandlers: jest.fn(),
}));

jest.mock('../../../src/socket/socketEmitters', () => ({
	initializeSocketEmitters: jest.fn(),
	emitUserStatusChange: jest.fn(),
}));

describe('Messages Routes - Integration Tests', () => {
	let user1: Awaited<ReturnType<typeof createTestUser>>;
	let user2: Awaited<ReturnType<typeof createTestUser>>;
	let chatId: string;

	beforeEach(async () => {
		await cleanDatabase();
		user1 = await createTestUser({
			email: 'user1@example.com',
			username: 'user1',
			password: 'password123',
		});
		user2 = await createTestUser({
			email: 'user2@example.com',
			username: 'user2',
			password: 'password123',
		});

		// Create friendship
		await prisma.friendship.create({
			data: {
				requesterId: user1.id,
				addresseeId: user2.id,
				createdBy: user1.id,
			},
		});

		// Create chat
		const chat = await prisma.chat.create({
			data: {
				isGroup: false,
				createdBy: user1.id,
				chatUsers: {
					create: [
						{
							userId: user1.id,
							role: ChatRole.USER,
							createdBy: user1.id,
						},
						{
							userId: user2.id,
							role: ChatRole.USER,
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
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.get(`/api/messages/${chatId}/messages`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.messages).toEqual([]);
			expect(response.body.data.total).toBe(0);
		});

		it('should return 404 when chat not found or user is not member', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.get('/api/messages/non-existent-id/messages')
				.set(headers)
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app)
				.get(`/api/messages/${chatId}/messages`)
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/messages/:chatId/messages', () => {
		it('should send message successfully', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create first message
			const firstMessage = await prisma.message.create({
				data: {
					chatId,
					senderId: user1.id,
					content: 'First message',
					createdBy: user1.id,
				},
			});

			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post(`/api/messages/${chatId}/messages`)
				.set(headers)
				.send({
					content: '',
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create message
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user1.id,
					content: 'Original message',
					createdBy: user1.id,
				},
			});

			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create message from user2
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user2.id,
					content: 'User2 message',
					createdBy: user2.id,
				},
			});

			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create message
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user1.id,
					content: 'Message to delete',
					createdBy: user1.id,
				},
			});

			const response = await request(app)
				.delete(`/api/messages/${message.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it('should return error when trying to delete another user message', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create message from user2
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user2.id,
					content: 'User2 message',
					createdBy: user2.id,
				},
			});

			const response = await request(app)
				.delete(`/api/messages/${message.id}`)
				.set(headers)
				.expect(403);

			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/messages/:messageId/reactions', () => {
		it('should add reaction to message successfully', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			// Create message
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user1.id,
					content: 'Test message',
					createdBy: user1.id,
				},
			});

			const response = await request(app)
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
			const headers = createAuthHeaders(user2.id, user2.email);

			// Create message from user1
			const message = await prisma.message.create({
				data: {
					chatId,
					senderId: user1.id,
					content: 'Test message',
					createdBy: user1.id,
				},
			});

			const response = await request(app)
				.post(`/api/messages/${message.id}/read`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});
});

