import { PrismaClient } from '@prisma/client';
import {
	User,
	Friend,
	FriendInviteResponse,
	SentInvite,
	ReceivedInvite,
	InvitesResponse,
	FriendshipResponse,
} from '../types/friends';

const prisma = new PrismaClient();

export class FriendsService {
	/**
	 * Gets all user's friends
	 */
	async getFriends(userId: string): Promise<Friend[]> {
		const friendships = await prisma.friendship.findMany({
			where: {
				OR: [{ requesterId: userId }, { addresseeId: userId }],
				deletedAt: null,
			},
			include: {
				requester: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
				addressee: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return friendships.map(friendship => {
			if (friendship.requesterId === userId) {
				return {
					...friendship.addressee,
					friendshipCreatedAt: friendship.createdAt,
				};
			} else {
				return {
					...friendship.requester,
					friendshipCreatedAt: friendship.createdAt,
				};
			}
		});
	}

	/**
	 * Sends a friend invitation
	 */
	async inviteFriend(senderId: string, username: string): Promise<FriendInviteResponse> {
		// Check if user is not trying to invite themselves
		const sender = await prisma.user.findUnique({
			where: { id: senderId },
			select: { username: true },
		});

		if (!sender) {
			throw new Error('User not found');
		}

		if (sender.username === username) {
			throw new Error('You cannot invite yourself');
		}

		// Find the user to invite
		const receiver = await prisma.user.findUnique({
			where: { username },
			select: {
				id: true,
				username: true,
				email: true,
				isOnline: true,
				lastSeen: true,
				createdAt: true,
			},
		});

		if (!receiver) {
			throw new Error('User with given username does not exist');
		}

		// Check if already friends
		const existingFriendship = await this.checkExistingFriendship(senderId, receiver.id);
		if (existingFriendship) {
			throw new Error('You are already friends');
		}

		// Check if there is already a pending invitation
		const existingInvite = await this.checkExistingInvite(senderId, receiver.id);
		if (existingInvite) {
			throw new Error('Invitation already sent or received');
		}

		// Create a new invitation
		const invite = await prisma.friendInvite.create({
			data: {
				senderId,
				receiverId: receiver.id,
				status: 'PENDING',
			},
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
				receiver: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
			},
		});

		return {
			id: invite.id,
			status: invite.status,
			createdAt: invite.createdAt,
			receiver: invite.receiver,
		};
	}

	/**
	 * Gets all user's invitations
	 */
	async getInvites(userId: string): Promise<InvitesResponse> {
		const invites = await prisma.friendInvite.findMany({
			where: {
				OR: [{ senderId: userId }, { receiverId: userId }],
				deletedAt: null,
			},
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
				receiver: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		const sentInvites: SentInvite[] = invites
			.filter(invite => invite.senderId === userId)
			.map(invite => ({
				id: invite.id,
				status: invite.status,
				createdAt: invite.createdAt,
				receiver: invite.receiver,
			}));

		const receivedInvites: ReceivedInvite[] = invites
			.filter(invite => invite.receiverId === userId)
			.map(invite => ({
				id: invite.id,
				status: invite.status,
				createdAt: invite.createdAt,
				sender: invite.sender,
			}));

		return {
			sentInvites,
			receivedInvites,
			totalSent: sentInvites.length,
			totalReceived: receivedInvites.length,
			totalPending: receivedInvites.filter(invite => invite.status === 'PENDING').length,
		};
	}

	/**
	 * Accepts a friend invitation
	 */
	async acceptInvite(inviteId: string, currentUserId: string): Promise<FriendshipResponse> {
		const invite = await this.findInviteById(inviteId);

		if (!invite) {
			throw new Error('Invitation not found');
		}

		if (invite.receiverId !== currentUserId) {
			throw new Error('You do not have permission to accept this invitation');
		}

		if (invite.status !== 'PENDING') {
			throw new Error('Invitation cannot be accepted');
		}

		// Check if they are not already friends
		const existingFriendship = await this.checkExistingFriendship(invite.senderId, invite.receiverId);
		if (existingFriendship) {
			throw new Error('You are already friends');
		}

		// Start transaction
		await prisma.$transaction(async tx => {
			// Update invitation status to ACCEPTED
			await tx.friendInvite.update({
				where: { id: inviteId },
				data: {
					status: 'ACCEPTED',
					updatedBy: currentUserId,
				},
			});

			// Create friendship relationship
			await tx.friendship.create({
				data: {
					requesterId: invite.senderId,
					addresseeId: invite.receiverId,
					createdBy: currentUserId,
				},
			});
		});

		return {
			requester: invite.sender,
			addressee: invite.receiver,
		};
	}

	/**
	 * Rejects a friend invitation
	 */
	async rejectInvite(inviteId: string, currentUserId: string): Promise<FriendInviteResponse> {
		const invite = await this.findInviteById(inviteId);

		if (!invite) {
			throw new Error('Invitation not found');
		}

		if (invite.receiverId !== currentUserId) {
			throw new Error('You do not have permission to reject this invitation');
		}

		if (invite.status !== 'PENDING') {
			throw new Error('Invitation cannot be rejected');
		}

		// Update invitation status to REJECTED
		await prisma.friendInvite.update({
			where: { id: inviteId },
			data: {
				status: 'REJECTED',
				updatedBy: currentUserId,
			},
		});

		return {
			id: invite.id,
			status: 'REJECTED',
			createdAt: invite.createdAt,
			sender: invite.sender,
		};
	}

	/**
	 * Removes a friend
	 */
	async deleteFriend(friendId: string, currentUserId: string): Promise<User> {
		if (currentUserId === friendId) {
			throw new Error('You cannot remove yourself from the friend list');
		}

		// Find friendship between users
		const friendship = await prisma.friendship.findFirst({
			where: {
				OR: [
					{ requesterId: currentUserId, addresseeId: friendId },
					{ requesterId: friendId, addresseeId: currentUserId },
				],
				deletedAt: null,
			},
			include: {
				requester: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
				addressee: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
			},
		});

		if (!friendship) {
			throw new Error('Friendship not found');
		}

		// Perform soft delete of friendship
		await prisma.friendship.update({
			where: { id: friendship.id },
			data: {
				deletedAt: new Date(),
				updatedBy: currentUserId,
			},
		});

		// Determine which user was removed as friend
		return friendship.requesterId === currentUserId ? friendship.addressee : friendship.requester;
	}

	// Private helper methods
	private async checkExistingFriendship(userId1: string, userId2: string): Promise<boolean> {
		const friendship = await prisma.friendship.findFirst({
			where: {
				OR: [
					{ requesterId: userId1, addresseeId: userId2 },
					{ requesterId: userId2, addresseeId: userId1 },
				],
				deletedAt: null,
			},
		});

		return !!friendship;
	}

	private async checkExistingInvite(senderId: string, receiverId: string): Promise<boolean> {
		const invite = await prisma.friendInvite.findFirst({
			where: {
				OR: [
					{ senderId, receiverId },
					{ senderId: receiverId, receiverId: senderId },
				],
				status: 'PENDING',
				deletedAt: null,
			},
		});

		return !!invite;
	}

	private async findInviteById(inviteId: string) {
		return await prisma.friendInvite.findUnique({
			where: {
				id: inviteId,
				deletedAt: null,
			},
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
				receiver: {
					select: {
						id: true,
						username: true,
						email: true,
						isOnline: true,
						lastSeen: true,
						createdAt: true,
					},
				},
			},
		});
	}
}
