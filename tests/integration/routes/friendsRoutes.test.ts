import request from 'supertest';
import { app } from '../../../src/app';
import { cleanDatabase } from '../../setup/testDatabase';
import { createTestUser, createAuthHeaders } from '../../helpers/testHelpers';
import { prisma } from '../../setup/testSetup';
import { FriendsService } from '../../../src/services/friendsService';

// Mock socket.io to prevent server initialization in tests
jest.mock('../../../src/socket/socketHandlers', () => ({
	initializeSocketHandlers: jest.fn(),
}));

jest.mock('../../../src/socket/socketEmitters', () => ({
	initializeSocketEmitters: jest.fn(),
	emitUserStatusChange: jest.fn(),
}));

describe('Friends Routes - Integration Tests', () => {
	let user1: Awaited<ReturnType<typeof createTestUser>>;
	let user2: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		await cleanDatabase();
		const timestamp = Date.now();
		user1 = await createTestUser({
			email: `user1-${timestamp}@example.com`,
			username: `user1-${timestamp}`,
			password: 'password123',
		});
		user2 = await createTestUser({
			email: `user2-${timestamp}@example.com`,
			username: `user2-${timestamp}`,
			password: 'password123',
		});
	});

	describe('GET /api/friends', () => {
		it('should return empty friends list for new user', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app).get('/api/friends').set(headers).expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.friends).toEqual([]);
			expect(response.body.data.count).toBe(0);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).get('/api/friends').expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('POST /api/friends/invite', () => {
		it('should send friend invitation successfully', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post('/api/friends/invite')
				.set(headers)
				.send({
					username: user2.username,
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.invite.receiver.id).toBe(user2.id);
			expect(response.body.data.invite.status).toBe('PENDING');
		});

		it('should return error when trying to invite yourself', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post('/api/friends/invite')
				.set(headers)
				.send({
					username: user1.username,
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return error when user does not exist', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.post('/api/friends/invite')
				.set(headers)
				.send({
					username: 'nonexistent',
				})
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app)
				.post('/api/friends/invite')
				.send({
					username: 'user2',
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('GET /api/friends/invites', () => {
		it('should return sent and received invites', async () => {
			// Create invitation using the service to ensure proper setup
			const friendsService = new FriendsService();
			await friendsService.inviteFriend(user1.id, user2.username);

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app).get('/api/friends/invites').set(headers).expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.sentInvites).toHaveLength(1);
			expect(response.body.data.receivedInvites).toHaveLength(0);
			expect(response.body.data.totalSent).toBe(1);
			expect(response.body.data.totalPending).toBe(0); // Pending received invites
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).get('/api/friends/invites').expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('PATCH /api/friends/invites/:id/accept', () => {
		it('should accept friend invitation successfully', async () => {
			// Create invitation using the service
			const friendsService = new FriendsService();
			const inviteResponse = await friendsService.inviteFriend(user1.id, user2.username);
			const inviteId = inviteResponse.id;

			const headers = createAuthHeaders(user2.id, user2.email);

			const response = await request(app)
				.patch(`/api/friends/invites/${inviteId}/accept`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);

			// Verify friendship was created
			const friendship = await prisma.friendship.findFirst({
				where: {
					OR: [
						{ requesterId: user1.id, addresseeId: user2.id },
						{ requesterId: user2.id, addresseeId: user1.id },
					],
					deletedAt: null,
				},
			});

			expect(friendship).toBeDefined();
		});

		it('should return error when trying to accept own invitation', async () => {
			// Create invitation using the service
			const friendsService = new FriendsService();
			const inviteResponse = await friendsService.inviteFriend(user1.id, user2.username);
			const inviteId = inviteResponse.id;

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.patch(`/api/friends/invites/${inviteId}/accept`)
				.set(headers)
				.expect(403);

			expect(response.body.success).toBe(false);
		});

		it('should return 404 when invitation not found', async () => {
			const headers = createAuthHeaders(user2.id, user2.email);

			const response = await request(app)
				.patch('/api/friends/invites/non-existent-id/accept')
				.set(headers)
				.expect(404);

			expect(response.body.success).toBe(false);
		});
	});

	describe('PATCH /api/friends/invites/:id/reject', () => {
		it('should reject friend invitation successfully', async () => {
			// Create invitation using the service
			const friendsService = new FriendsService();
			const inviteResponse = await friendsService.inviteFriend(user1.id, user2.username);
			const inviteId = inviteResponse.id;

			const headers = createAuthHeaders(user2.id, user2.email);

			const response = await request(app)
				.patch(`/api/friends/invites/${inviteId}/reject`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);

			// Verify invitation status was updated
			const updatedInvite = await prisma.friendInvite.findUnique({
				where: { id: inviteId },
			});

			expect(updatedInvite?.status).toBe('REJECTED');
		});

		it('should return error when trying to reject own invitation', async () => {
			// Create invitation using the service
			const friendsService = new FriendsService();
			const inviteResponse = await friendsService.inviteFriend(user1.id, user2.username);
			const inviteId = inviteResponse.id;

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app)
				.patch(`/api/friends/invites/${inviteId}/reject`)
				.set(headers)
				.expect(403);

			expect(response.body.success).toBe(false);
		});
	});

	describe('DELETE /api/friends/:friendId', () => {
		it('should remove friend successfully', async () => {
			// Create friendship
			await prisma.friendship.create({
				data: {
					requesterId: user1.id,
					addresseeId: user2.id,
					createdBy: user1.id,
				},
			});

			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app).delete(`/api/friends/${user2.id}`).set(headers).expect(200);

			expect(response.body.success).toBe(true);

			// Verify friendship was soft deleted
			const friendship = await prisma.friendship.findFirst({
				where: {
					OR: [
						{ requesterId: user1.id, addresseeId: user2.id },
						{ requesterId: user2.id, addresseeId: user1.id },
					],
					deletedAt: null,
				},
			});

			expect(friendship).toBeNull();
		});

		it('should return error when friendship not found', async () => {
			const headers = createAuthHeaders(user1.id, user1.email);

			const response = await request(app).delete(`/api/friends/${user2.id}`).set(headers).expect(404);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).delete(`/api/friends/${user2.id}`).expect(401);

			expect(response.body.success).toBe(false);
		});
	});
});
