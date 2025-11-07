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

describe('Chat Routes - Integration Tests', () => {
	let user1: Awaited<ReturnType<typeof createTestUser>>;
	let user2: Awaited<ReturnType<typeof createTestUser>>;

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

		// Create friendship between users
		await prisma.friendship.create({
			data: {
				requesterId: user1.id,
				addresseeId: user2.id,
				createdBy: user1.id,
			},
		});
	});

	describe('GET /api/chats', () => {
		it('should return empty chats list for new user', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.get('/api/chats')
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.chats).toEqual([]);
			expect(response.body.data.total).toBe(0);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).get('/api/chats').expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/chats', () => {
		it('should create 1-on-1 chat successfully', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
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
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post('/api/chats')
				.set(headers)
				.send({
					participantId: user1.id,
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return error when users are not friends', async () => {
			const user3 = await createTestUser({
				email: 'user3@example.com',
				username: 'user3',
				password: 'password123',
			});
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post('/api/chats')
				.set(headers)
				.send({
					participantId: user3.id,
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should create group chat successfully', async () => {
			const user3 = await createTestUser({
				email: 'user3@example.com',
				username: 'user3',
				password: 'password123',
			});

			// Create friendships
			await prisma.friendship.create({
				data: {
					requesterId: user1.id,
					addresseeId: user3.id,
					createdBy: user1.id,
				},
			});

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
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
			const response = await request(app)
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

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.get(`/api/chats/${chat.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(chat.id);
		});

		it('should return 404 when chat not found or user is not member', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.get('/api/chats/non-existent-id')
				.set(headers)
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});

	describe('DELETE /api/chats/:id', () => {
		it('should delete 1-on-1 chat successfully', async () => {
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

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.delete(`/api/chats/${chat.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it('should delete group chat when user is owner', async () => {
			// Create group chat
			const chat = await prisma.chat.create({
				data: {
					isGroup: true,
					name: 'Test Group',
					createdBy: user1.id,
					chatUsers: {
						create: [
							{
								userId: user1.id,
								role: ChatRole.OWNER,
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

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.delete(`/api/chats/${chat.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});
});

