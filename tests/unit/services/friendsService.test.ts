import { FriendsService } from '../../../src/services/friendsService';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
	const mockFriendship = {
		findMany: jest.fn(),
		findFirst: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
	};
	const mockFriendInvite = {
		findFirst: jest.fn(),
		findMany: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	};
	const mockUser = {
		findUnique: jest.fn(),
	};
	const mockTransaction = jest.fn();

	(global as any).__mockPrismaInstance = {
		friendship: mockFriendship,
		friendInvite: mockFriendInvite,
		user: mockUser,
		$transaction: mockTransaction,
		$disconnect: jest.fn(),
	};

	return {
		PrismaClient: jest.fn(() => (global as any).__mockPrismaInstance),
	};
});

const getMockPrisma = () => (global as any).__mockPrismaInstance;

describe('FriendsService - Unit Tests', () => {
	let friendsService: FriendsService;

	beforeEach(() => {
		jest.clearAllMocks();
		friendsService = new FriendsService();
	});

	describe('getFriends', () => {
		it('should return friends list', async () => {
			const mockPrisma = getMockPrisma();
			const mockFriendships = [
				{
					id: '1',
					requesterId: 'user1',
					addresseeId: 'user2',
					createdAt: new Date(),
					requester: {
						id: 'user1',
						username: 'user1',
						email: 'user1@example.com',
						isOnline: true,
						lastSeen: new Date(),
						createdAt: new Date(),
					},
					addressee: {
						id: 'user2',
						username: 'user2',
						email: 'user2@example.com',
						isOnline: false,
						lastSeen: null,
						createdAt: new Date(),
					},
				},
			];

			(mockPrisma.friendship.findMany as jest.Mock).mockResolvedValue(mockFriendships);

			const result = await friendsService.getFriends('user1');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('user2');
			expect(result[0].friendshipCreatedAt).toBeDefined();
		});

		it('should return empty array when no friends', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.friendship.findMany as jest.Mock).mockResolvedValue([]);

			const result = await friendsService.getFriends('user1');

			expect(result).toEqual([]);
		});
	});

	describe('inviteFriend', () => {
		it('should throw error when sender not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(friendsService.inviteFriend('non-existent', 'user2')).rejects.toThrow(
				'User not found',
			);
		});

		it('should throw error when trying to invite yourself', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
				id: 'user1',
				username: 'user1',
			});

			await expect(friendsService.inviteFriend('user1', 'user1')).rejects.toThrow(
				'You cannot invite yourself',
			);
		});

		it('should throw error when receiver not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ id: 'user1', username: 'user1' }) // Sender
				.mockResolvedValueOnce(null); // Receiver

			await expect(friendsService.inviteFriend('user1', 'nonexistent')).rejects.toThrow(
				'User with given username does not exist',
			);
		});

		it('should throw error when already friends', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ id: 'user1', username: 'user1' }) // Sender
				.mockResolvedValueOnce({
					id: 'user2',
					username: 'user2',
					email: 'user2@example.com',
					isOnline: false,
					lastSeen: null,
					createdAt: new Date(),
				}); // Receiver

			// Mock checkExistingFriendship
			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValue({
				id: 'friendship1',
			});

			await expect(friendsService.inviteFriend('user1', 'user2')).rejects.toThrow(
				'You are already friends',
			);
		});

		it('should throw error when invitation already exists', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ id: 'user1', username: 'user1' }) // Sender
				.mockResolvedValueOnce({
					id: 'user2',
					username: 'user2',
					email: 'user2@example.com',
					isOnline: false,
					lastSeen: null,
					createdAt: new Date(),
				}); // Receiver

			// Mock checkExistingFriendship returns null
			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValueOnce(null);
			// Mock checkExistingInvite returns true
			(mockPrisma.friendInvite.findFirst as jest.Mock).mockResolvedValue({
				id: 'invite1',
			});

			await expect(friendsService.inviteFriend('user1', 'user2')).rejects.toThrow(
				'Invitation already sent or received',
			);
		});

		it('should create invitation successfully', async () => {
			const mockPrisma = getMockPrisma();
			const receiver = {
				id: 'user2',
				username: 'user2',
				email: 'user2@example.com',
				isOnline: false,
				lastSeen: null,
				createdAt: new Date(),
			};

			(mockPrisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ id: 'user1', username: 'user1' }) // Sender
				.mockResolvedValueOnce(receiver); // Receiver

			// Mock checkExistingFriendship returns null
			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValueOnce(null);
			// Mock checkExistingInvite returns null
			(mockPrisma.friendInvite.findFirst as jest.Mock).mockResolvedValueOnce(null);

			const mockInvite = {
				id: 'invite1',
				status: 'PENDING',
				createdAt: new Date(),
				receiver,
				sender: {
					id: 'user1',
					username: 'user1',
					email: 'user1@example.com',
					isOnline: true,
					lastSeen: new Date(),
					createdAt: new Date(),
				},
			};

			(mockPrisma.friendInvite.create as jest.Mock).mockResolvedValue(mockInvite);

			const result = await friendsService.inviteFriend('user1', 'user2');

			expect(result.id).toBe('invite1');
			expect(result.status).toBe('PENDING');
			expect(result.receiver).toEqual(receiver);
		});
	});

	describe('getInvites', () => {
		it('should return sent and received invites', async () => {
			const mockPrisma = getMockPrisma();
			const mockInvites = [
				{
					id: 'invite1',
					senderId: 'user1',
					receiverId: 'user2',
					status: 'PENDING',
					createdAt: new Date(),
					sender: {
						id: 'user1',
						username: 'user1',
						email: 'user1@example.com',
						isOnline: true,
						lastSeen: new Date(),
						createdAt: new Date(),
					},
					receiver: {
						id: 'user2',
						username: 'user2',
						email: 'user2@example.com',
						isOnline: false,
						lastSeen: null,
						createdAt: new Date(),
					},
				},
			];

			(mockPrisma.friendInvite.findMany as jest.Mock).mockResolvedValue(mockInvites);

			const result = await friendsService.getInvites('user1');

			expect(result.sentInvites).toHaveLength(1);
			expect(result.receivedInvites).toHaveLength(0);
			expect(result.totalSent).toBe(1);
			expect(result.totalReceived).toBe(0);
		});
	});

	describe('acceptInvite', () => {
		it('should throw error when invitation not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(friendsService.acceptInvite('non-existent', 'user2')).rejects.toThrow(
				'Invitation not found',
			);
		});

		it('should throw error when user is not receiver', async () => {
			const mockPrisma = getMockPrisma();
			const mockInvite = {
				id: 'invite1',
				senderId: 'user1',
				receiverId: 'user2',
				status: 'PENDING',
				sender: { id: 'user1' },
				receiver: { id: 'user2' },
			};

			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);

			await expect(friendsService.acceptInvite('invite1', 'user1')).rejects.toThrow(
				'You do not have permission to accept this invitation',
			);
		});

		it('should throw error when invitation is not pending', async () => {
			const mockPrisma = getMockPrisma();
			const mockInvite = {
				id: 'invite1',
				senderId: 'user1',
				receiverId: 'user2',
				status: 'ACCEPTED',
				sender: { id: 'user1' },
				receiver: { id: 'user2' },
			};

			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);

			await expect(friendsService.acceptInvite('invite1', 'user2')).rejects.toThrow(
				'Invitation cannot be accepted',
			);
		});

		it('should accept invitation and create friendship', async () => {
			const mockPrisma = getMockPrisma();
			const mockInvite = {
				id: 'invite1',
				senderId: 'user1',
				receiverId: 'user2',
				status: 'PENDING',
				sender: {
					id: 'user1',
					username: 'user1',
					email: 'user1@example.com',
					isOnline: true,
					lastSeen: new Date(),
					createdAt: new Date(),
				},
				receiver: {
					id: 'user2',
					username: 'user2',
					email: 'user2@example.com',
					isOnline: false,
					lastSeen: null,
					createdAt: new Date(),
				},
			};

			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);
			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValue(null); // Not already friends

			// Mock transaction
			(mockPrisma.$transaction as jest.Mock).mockImplementation(async callback => {
				const tx = {
					friendInvite: {
						update: jest.fn().mockResolvedValue({ ...mockInvite, status: 'ACCEPTED' }),
					},
					friendship: {
						create: jest.fn().mockResolvedValue({
							id: 'friendship1',
							requesterId: 'user1',
							addresseeId: 'user2',
						}),
					},
				};
				return callback(tx);
			});

			const result = await friendsService.acceptInvite('invite1', 'user2');

			expect(result.requester.id).toBe('user1');
			expect(result.addressee.id).toBe('user2');
		});
	});

	describe('rejectInvite', () => {
		it('should throw error when invitation not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(null);

			await expect(friendsService.rejectInvite('non-existent', 'user2')).rejects.toThrow(
				'Invitation not found',
			);
		});

		it('should reject invitation successfully', async () => {
			const mockPrisma = getMockPrisma();
			const mockInvite = {
				id: 'invite1',
				senderId: 'user1',
				receiverId: 'user2',
				status: 'PENDING',
				createdAt: new Date(),
				sender: {
					id: 'user1',
					username: 'user1',
					email: 'user1@example.com',
					isOnline: true,
					lastSeen: new Date(),
					createdAt: new Date(),
				},
			};

			(mockPrisma.friendInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);
			(mockPrisma.friendInvite.update as jest.Mock).mockResolvedValue({
				...mockInvite,
				status: 'REJECTED',
			});

			const result = await friendsService.rejectInvite('invite1', 'user2');

			expect(result.status).toBe('REJECTED');
			expect(mockPrisma.friendInvite.update).toHaveBeenCalled();
		});
	});

	describe('deleteFriend', () => {
		it('should throw error when trying to remove yourself', async () => {
			await expect(friendsService.deleteFriend('user1', 'user1')).rejects.toThrow(
				'You cannot remove yourself from the friend list',
			);
		});

		it('should throw error when friendship not found', async () => {
			const mockPrisma = getMockPrisma();
			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValue(null);

			await expect(friendsService.deleteFriend('user2', 'user1')).rejects.toThrow(
				'Friendship not found',
			);
		});

		it('should delete friend successfully', async () => {
			const mockPrisma = getMockPrisma();
			const mockFriendship = {
				id: 'friendship1',
				requesterId: 'user1',
				addresseeId: 'user2',
				requester: {
					id: 'user1',
					username: 'user1',
					email: 'user1@example.com',
					isOnline: true,
					lastSeen: new Date(),
					createdAt: new Date(),
				},
				addressee: {
					id: 'user2',
					username: 'user2',
					email: 'user2@example.com',
					isOnline: false,
					lastSeen: null,
					createdAt: new Date(),
				},
			};

			(mockPrisma.friendship.findFirst as jest.Mock).mockResolvedValue(mockFriendship);
			(mockPrisma.friendship.update as jest.Mock).mockResolvedValue({
				...mockFriendship,
				deletedAt: new Date(),
			});

			const result = await friendsService.deleteFriend('user2', 'user1');

			expect(result.id).toBe('user2');
			expect(mockPrisma.friendship.update).toHaveBeenCalled();
		});
	});
});
