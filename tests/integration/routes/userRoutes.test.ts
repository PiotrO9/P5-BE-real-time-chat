import request from 'supertest';
import { app } from '../../../src/app';
import { cleanDatabase } from '../../setup/testDatabase';
import { createTestUser, createAuthHeaders } from '../../helpers/testHelpers';

// Mock socket.io to prevent server initialization in tests
jest.mock('../../../src/socket/socketHandlers', () => ({
	initializeSocketHandlers: jest.fn(),
}));

jest.mock('../../../src/socket/socketEmitters', () => ({
	initializeSocketEmitters: jest.fn(),
	emitUserStatusChange: jest.fn(),
}));

describe('User Routes - Integration Tests', () => {
	beforeEach(async () => {
		await cleanDatabase();
	});

	describe('GET /api/users', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should return paginated users when authenticated', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.get('/api/users?page=1&limit=20')
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.users).toBeDefined();
			expect(response.body.data.pagination).toBeDefined();
			expect(response.body.data.pagination.currentPage).toBe(1);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).get('/api/users').expect(401);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe('Access token required');
		});
	});

	describe('GET /api/users/:id', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should return user profile when authenticated', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.get(`/api/users/${testUser.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(testUser.id);
			expect(response.body.data.email).toBe(testUser.email);
			expect(response.body.data.username).toBe(testUser.username);
		});

		it('should return 404 when user not found', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.get('/api/users/non-existent-id')
				.set(headers)
				.expect(404);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).get(`/api/users/${testUser.id}`).expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('GET /api/users/:id/status', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should return user status when authenticated', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.get(`/api/users/${testUser.id}/status`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.status).toBeDefined();
			expect(['online', 'offline']).toContain(response.body.data.status);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app)
				.get(`/api/users/${testUser.id}/status`)
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('PUT /api/users/:id', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should update user profile when authenticated and authorized', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.put(`/api/users/${testUser.id}`)
				.set(headers)
				.send({
					username: 'newusername',
					email: 'newemail@example.com',
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.username).toBe('newusername');
			expect(response.body.data.email).toBe('newemail@example.com');
		});

		it('should return 403 when trying to update another user', async () => {
			const otherUser = await createTestUser({
				email: 'other@example.com',
				username: 'otheruser',
				password: 'password123',
			});
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.put(`/api/users/${otherUser.id}`)
				.set(headers)
				.send({
					username: 'newusername',
				})
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe('You can only modify your own profile');
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app)
				.put(`/api/users/${testUser.id}`)
				.send({
					username: 'newusername',
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe('PATCH /api/users/:id/password', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should update password when authenticated and authorized', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.patch(`/api/users/${testUser.id}/password`)
				.set(headers)
				.send({
					currentPassword: 'password123',
					newPassword: 'newpassword123',
				})
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it('should return 400 when current password is incorrect', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.patch(`/api/users/${testUser.id}/password`)
				.set(headers)
				.send({
					currentPassword: 'wrongpassword',
					newPassword: 'newpassword123',
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it('should return 403 when trying to update another user password', async () => {
			const otherUser = await createTestUser({
				email: 'other@example.com',
				username: 'otheruser',
				password: 'password123',
			});
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.patch(`/api/users/${otherUser.id}/password`)
				.set(headers)
				.send({
					currentPassword: 'password123',
					newPassword: 'newpassword123',
				})
				.expect(403);

			expect(response.body.success).toBe(false);
		});
	});

	describe('DELETE /api/users/:id', () => {
		let testUser: Awaited<ReturnType<typeof createTestUser>>;

		beforeEach(async () => {
			testUser = await createTestUser({
				email: 'test@example.com',
				username: 'testuser',
				password: 'password123',
			});
		});

		it('should delete user when authenticated and authorized', async () => {
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.delete(`/api/users/${testUser.id}`)
				.set(headers)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it('should return 403 when trying to delete another user', async () => {
			const otherUser = await createTestUser({
				email: 'other@example.com',
				username: 'otheruser',
				password: 'password123',
			});
			const headers = createAuthHeaders(testUser.id, testUser.email);

			const response = await request(app)
				.delete(`/api/users/${otherUser.id}`)
				.set(headers)
				.expect(403);

			expect(response.body.success).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			const response = await request(app).delete(`/api/users/${testUser.id}`).expect(401);

			expect(response.body.success).toBe(false);
		});
	});
});

