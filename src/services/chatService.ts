import { PrismaClient, ChatRole } from '@prisma/client';
import { ChatResponse, ChatsListResponse, LastMessage, ChatMember } from '../types/chat';

const prisma = new PrismaClient();

interface CreateChatDTO {
	// For 1-on-1 chat
	participantId?: string;
	// For group chat
	name?: string;
	participantIds?: string[];
}

export class ChatService {
	/**
	 * Gets all chats for a user with last message and unread count
	 */
	async getChats(userId: string): Promise<ChatsListResponse> {
		// Find all chats where user is a member
		const chatUsers = await prisma.chatUser.findMany({
			where: {
				userId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
							include: {
								user: {
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
						},
						messages: {
							where: {
								deletedAt: null,
							},
							orderBy: {
								createdAt: 'desc',
							},
							take: 1,
							include: {
								sender: {
									select: {
										username: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: {
				chat: {
					updatedAt: 'desc',
				},
			},
		});

		// Process each chat to create response
		const chats: ChatResponse[] = await Promise.all(
			chatUsers.map(async chatUser => {
				const chat = chatUser.chat;

				// Get last message
				const lastMessage: LastMessage | null =
					chat.messages.length > 0
						? {
								id: chat.messages[0].id,
								content: chat.messages[0].content,
								senderId: chat.messages[0].senderId,
								senderUsername: chat.messages[0].sender.username,
								createdAt: chat.messages[0].createdAt,
								wasUpdated: chat.messages[0].wasUpdated,
						  }
						: null;

				// Count unread messages
				const unreadCount = await this.getUnreadCount(userId, chat.id);

				// Base chat response
				const chatResponse: ChatResponse = {
					id: chat.id,
					name: chat.name,
					isGroup: chat.isGroup,
					createdAt: chat.createdAt,
					updatedAt: chat.updatedAt,
					lastMessage,
					unreadCount,
				};

				// If it's a 1-on-1 chat, add other user info
				if (!chat.isGroup) {
					const otherChatUser = chat.chatUsers.find(cu => cu.userId !== userId);
					if (otherChatUser) {
						chatResponse.otherUser = {
							id: otherChatUser.user.id,
							username: otherChatUser.user.username,
							email: otherChatUser.user.email,
							isOnline: otherChatUser.user.isOnline,
							lastSeen: otherChatUser.user.lastSeen,
							createdAt: otherChatUser.user.createdAt,
						};
					}
				} else {
					// If it's a group chat, add members info
					const members: ChatMember[] = chat.chatUsers.map(cu => ({
						id: cu.user.id,
						username: cu.user.username,
						email: cu.user.email,
						isOnline: cu.user.isOnline,
						lastSeen: cu.user.lastSeen,
						role: cu.role,
						joinedAt: cu.joinedAt,
					}));

					chatResponse.members = members;
					chatResponse.memberCount = members.length;
				}

				return chatResponse;
			}),
		);

		// Sort chats by last message date (most recent first)
		chats.sort((a, b) => {
			const dateA = a.lastMessage?.createdAt || a.updatedAt;
			const dateB = b.lastMessage?.createdAt || b.updatedAt;
			return dateB.getTime() - dateA.getTime();
		});

		return {
			chats,
			total: chats.length,
		};
	}

	/**
	 * Creates a new chat (1-on-1 or group)
	 */
	async createChat(userId: string, data: CreateChatDTO): Promise<ChatResponse> {
		// Check if it's a 1-on-1 or group chat
		const isGroupChat = !!data.participantIds && !!data.name;

		if (isGroupChat) {
			// Create group chat
			return this.createGroupChat(userId, data.name!, data.participantIds!);
		} else {
			// Create 1-on-1 chat
			return this.createOneOnOneChat(userId, data.participantId!);
		}
	}

	/**
	 * Creates a 1-on-1 chat between two users
	 */
	private async createOneOnOneChat(userId: string, participantId: string): Promise<ChatResponse> {
		// Validate that participant exists
		const participant = await prisma.user.findUnique({
			where: { id: participantId, deletedAt: null },
		});

		if (!participant) {
			throw new Error('Participant not found');
		}

		// Check if users are the same
		if (userId === participantId) {
			throw new Error('Cannot create chat with yourself');
		}

		// Check if users are friends
		const friendship = await prisma.friendship.findFirst({
			where: {
				OR: [
					{
						requesterId: userId,
						addresseeId: participantId,
						deletedAt: null,
					},
					{
						requesterId: participantId,
						addresseeId: userId,
						deletedAt: null,
					},
				],
			},
		});

		if (!friendship) {
			throw new Error('You can only create chats with friends');
		}

		// Check if chat already exists between these two users
		const existingChat = await prisma.chat.findFirst({
			where: {
				isGroup: false,
				deletedAt: null,
				chatUsers: {
					every: {
						userId: {
							in: [userId, participantId],
						},
						deletedAt: null,
					},
				},
			},
			include: {
				chatUsers: {
					where: {
						deletedAt: null,
					},
				},
			},
		});

		// If chat exists and has exactly these 2 users, return it
		if (existingChat && existingChat.chatUsers.length === 2) {
			const chatUserIds = existingChat.chatUsers.map(cu => cu.userId).sort();
			const targetUserIds = [userId, participantId].sort();

			if (chatUserIds[0] === targetUserIds[0] && chatUserIds[1] === targetUserIds[1]) {
				// Return existing chat
				const chatResponse = await this.getChatById(userId, existingChat.id);
				return chatResponse;
			}
		}

		// Create new 1-on-1 chat
		const chat = await prisma.chat.create({
			data: {
				isGroup: false,
				createdBy: userId,
				chatUsers: {
					create: [
						{
							userId: userId,
							role: ChatRole.USER,
							createdBy: userId,
						},
						{
							userId: participantId,
							role: ChatRole.USER,
							createdBy: userId,
						},
					],
				},
			},
			include: {
				chatUsers: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
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
				},
			},
		});

		// Build response
		const otherUser = chat.chatUsers.find(cu => cu.userId !== userId);

		const chatResponse: ChatResponse = {
			id: chat.id,
			name: chat.name,
			isGroup: chat.isGroup,
			createdAt: chat.createdAt,
			updatedAt: chat.updatedAt,
			lastMessage: null,
			unreadCount: 0,
			otherUser: otherUser
				? {
						id: otherUser.user.id,
						username: otherUser.user.username,
						email: otherUser.user.email,
						isOnline: otherUser.user.isOnline,
						lastSeen: otherUser.user.lastSeen,
						createdAt: otherUser.user.createdAt,
				  }
				: undefined,
		};

		return chatResponse;
	}

	/**
	 * Creates a group chat
	 */
	private async createGroupChat(
		userId: string,
		name: string,
		participantIds: string[],
	): Promise<ChatResponse> {
		// Remove duplicates and current user from participantIds
		const uniqueParticipantIds = [...new Set(participantIds.filter(id => id !== userId))];

		if (uniqueParticipantIds.length < 2) {
			throw new Error('Group chat must have at least 2 other participants');
		}

		// Validate that all participants exist
		const participants = await prisma.user.findMany({
			where: {
				id: { in: uniqueParticipantIds },
				deletedAt: null,
			},
		});

		if (participants.length !== uniqueParticipantIds.length) {
			throw new Error('Some participants not found');
		}

		// Check if all participants are friends with the creator
		const friendships = await prisma.friendship.findMany({
			where: {
				OR: [
					{
						requesterId: userId,
						addresseeId: { in: uniqueParticipantIds },
						deletedAt: null,
					},
					{
						requesterId: { in: uniqueParticipantIds },
						addresseeId: userId,
						deletedAt: null,
					},
				],
			},
		});

		const friendIds = new Set(
			friendships.map(f => (f.requesterId === userId ? f.addresseeId : f.requesterId)),
		);

		const nonFriends = uniqueParticipantIds.filter(id => !friendIds.has(id));

		if (nonFriends.length > 0) {
			throw new Error('You can only add friends to group chats');
		}

		// Create group chat
		const chat = await prisma.chat.create({
			data: {
				name: name,
				isGroup: true,
				createdBy: userId,
				chatUsers: {
					create: [
						// Creator as OWNER
						{
							userId: userId,
							role: ChatRole.OWNER,
							createdBy: userId,
						},
						// Participants as USER
						...uniqueParticipantIds.map(participantId => ({
							userId: participantId,
							role: ChatRole.USER,
							createdBy: userId,
						})),
					],
				},
			},
			include: {
				chatUsers: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
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
				},
			},
		});

		// Build response
		const members: ChatMember[] = chat.chatUsers.map(cu => ({
			id: cu.user.id,
			username: cu.user.username,
			email: cu.user.email,
			isOnline: cu.user.isOnline,
			lastSeen: cu.user.lastSeen,
			role: cu.role,
			joinedAt: cu.joinedAt,
		}));

		const chatResponse: ChatResponse = {
			id: chat.id,
			name: chat.name,
			isGroup: chat.isGroup,
			createdAt: chat.createdAt,
			updatedAt: chat.updatedAt,
			lastMessage: null,
			unreadCount: 0,
			members: members,
			memberCount: members.length,
		};

		return chatResponse;
	}

	/**
	 * Gets a specific chat by ID
	 */
	async getChatById(userId: string, chatId: string): Promise<ChatResponse> {
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
							include: {
								user: {
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
						},
						messages: {
							where: {
								deletedAt: null,
							},
							orderBy: {
								createdAt: 'desc',
							},
							take: 1,
							include: {
								sender: {
									select: {
										username: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found');
		}

		const chat = chatUser.chat;

		// Get last message
		const lastMessage: LastMessage | null =
			chat.messages.length > 0
				? {
						id: chat.messages[0].id,
						content: chat.messages[0].content,
						senderId: chat.messages[0].senderId,
						senderUsername: chat.messages[0].sender.username,
						createdAt: chat.messages[0].createdAt,
						wasUpdated: chat.messages[0].wasUpdated,
				  }
				: null;

		// Count unread messages
		const unreadCount = await this.getUnreadCount(userId, chat.id);

		// Base chat response
		const chatResponse: ChatResponse = {
			id: chat.id,
			name: chat.name,
			isGroup: chat.isGroup,
			createdAt: chat.createdAt,
			updatedAt: chat.updatedAt,
			lastMessage,
			unreadCount,
		};

		// If it's a 1-on-1 chat, add other user info
		if (!chat.isGroup) {
			const otherChatUser = chat.chatUsers.find(cu => cu.userId !== userId);
			if (otherChatUser) {
				chatResponse.otherUser = {
					id: otherChatUser.user.id,
					username: otherChatUser.user.username,
					email: otherChatUser.user.email,
					isOnline: otherChatUser.user.isOnline,
					lastSeen: otherChatUser.user.lastSeen,
					createdAt: otherChatUser.user.createdAt,
				};
			}
		} else {
			// If it's a group chat, add members info
			const members: ChatMember[] = chat.chatUsers.map(cu => ({
				id: cu.user.id,
				username: cu.user.username,
				email: cu.user.email,
				isOnline: cu.user.isOnline,
				lastSeen: cu.user.lastSeen,
				role: cu.role,
				joinedAt: cu.joinedAt,
			}));

			chatResponse.members = members;
			chatResponse.memberCount = members.length;
		}

		return chatResponse;
	}

	/**
	 * Gets unread message count for a user in a specific chat
	 */
	private async getUnreadCount(userId: string, chatId: string): Promise<number> {
		// Get all messages in the chat
		const messages = await prisma.message.findMany({
			where: {
				chatId,
				deletedAt: null,
				// Don't count user's own messages
				senderId: {
					not: userId,
				},
			},
			select: {
				id: true,
			},
		});

		// Get messages that user has read
		const readMessages = await prisma.messageRead.findMany({
			where: {
				userId,
				messageId: {
					in: messages.map(m => m.id),
				},
				deletedAt: null,
			},
			select: {
				messageId: true,
			},
		});

		const readMessageIds = new Set(readMessages.map(r => r.messageId));

		// Count messages that haven't been read
		const unreadCount = messages.filter(m => !readMessageIds.has(m.id)).length;

		return unreadCount;
	}

	/**
	 * Deletes a chat (soft delete)
	 * For 1-on-1 chats: any user can delete it (removes them from chat)
	 * For group chats: only OWNER can delete the entire chat for all members
	 */
	async deleteChat(userId: string, chatId: string): Promise<void> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
						},
					},
				},
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		const chat = chatUser.chat;

		// If it's a 1-on-1 chat, just soft delete the chatUser
		if (!chat.isGroup) {
			await prisma.chatUser.update({
				where: {
					id: chatUser.id,
				},
				data: {
					deletedAt: new Date(),
					updatedBy: userId,
				},
			});
			return;
		}

		// For group chats - only OWNER can delete the entire chat
		if (chatUser.role !== ChatRole.OWNER) {
			throw new Error('Only chat owner can delete group chats');
		}

		// Delete entire group chat (soft delete all members and the chat itself)
		await prisma.$transaction([
			// Soft delete all chat users
			prisma.chatUser.updateMany({
				where: {
					chatId,
					deletedAt: null,
				},
				data: {
					deletedAt: new Date(),
					updatedBy: userId,
				},
			}),
			// Soft delete the chat
			prisma.chat.update({
				where: {
					id: chatId,
				},
				data: {
					deletedAt: new Date(),
					updatedBy: userId,
				},
			}),
		]);
	}

	/**
	 * Updates a group chat's settings (name)
	 * Only OWNER or MODERATOR can update chat settings
	 */
	async updateChat(userId: string, chatId: string, name: string): Promise<ChatResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: true,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Check if it's a group chat
		if (!chatUser.chat.isGroup) {
			throw new Error('Cannot update 1-on-1 chat settings');
		}

		// Check if user has permission to update chat (must be OWNER or MODERATOR)
		if (chatUser.role !== ChatRole.OWNER && chatUser.role !== ChatRole.MODERATOR) {
			throw new Error('Only chat owner or moderator can update chat settings');
		}

		// Update chat
		await prisma.chat.update({
			where: {
				id: chatId,
			},
			data: {
				name: name,
				updatedBy: userId,
			},
		});

		// Return updated chat
		const updatedChat = await this.getChatById(userId, chatId);
		return updatedChat;
	}

	/**
	 * Adds members to a group chat
	 * Only OWNER or MODERATOR can add members
	 */
	async addChatMembers(userId: string, chatId: string, userIds: string[]): Promise<ChatResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
						},
					},
				},
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Check if it's a group chat
		if (!chatUser.chat.isGroup) {
			throw new Error('Cannot add members to 1-on-1 chat');
		}

		// Check if user has permission to add members (must be OWNER or MODERATOR)
		if (chatUser.role !== ChatRole.OWNER && chatUser.role !== ChatRole.MODERATOR) {
			throw new Error('Only chat owner or moderator can add members');
		}

		// Remove duplicates and current user from userIds
		const uniqueUserIds = [...new Set(userIds.filter(id => id !== userId))];

		if (uniqueUserIds.length === 0) {
			throw new Error('No valid users to add');
		}

		// Check if users exist
		const users = await prisma.user.findMany({
			where: {
				id: { in: uniqueUserIds },
				deletedAt: null,
			},
		});

		if (users.length !== uniqueUserIds.length) {
			throw new Error('Some users not found');
		}

		// Check if users are friends with the person adding them
		const friendships = await prisma.friendship.findMany({
			where: {
				OR: [
					{
						requesterId: userId,
						addresseeId: { in: uniqueUserIds },
						deletedAt: null,
					},
					{
						requesterId: { in: uniqueUserIds },
						addresseeId: userId,
						deletedAt: null,
					},
				],
			},
		});

		const friendIds = new Set(
			friendships.map(f => (f.requesterId === userId ? f.addresseeId : f.requesterId)),
		);

		const nonFriends = uniqueUserIds.filter(id => !friendIds.has(id));

		if (nonFriends.length > 0) {
			throw new Error('You can only add friends to group chats');
		}

		// Check if users are already members of the chat
		const currentMemberIds = new Set(chatUser.chat.chatUsers.map(cu => cu.userId));
		const newUserIds = uniqueUserIds.filter(id => !currentMemberIds.has(id));

		if (newUserIds.length === 0) {
			throw new Error('All users are already members of this chat');
		}

		// Add new members to the chat
		await prisma.chatUser.createMany({
			data: newUserIds.map(newUserId => ({
				chatId: chatId,
				userId: newUserId,
				role: ChatRole.USER,
				createdBy: userId,
			})),
		});

		// Return updated chat
		const updatedChat = await this.getChatById(userId, chatId);
		return updatedChat;
	}

	/**
	 * Removes members from a group chat
	 * Only OWNER or MODERATOR can remove members
	 * MODERATOR can only remove USER role members
	 * OWNER can remove USER or MODERATOR role members
	 * Cannot remove OWNER or yourself
	 */
	async removeChatMembers(userId: string, chatId: string, userIds: string[]): Promise<ChatResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
						},
					},
				},
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Check if it's a group chat
		if (!chatUser.chat.isGroup) {
			throw new Error('Cannot remove members from 1-on-1 chat');
		}

		// Check if user has permission to remove members (must be OWNER or MODERATOR)
		if (chatUser.role !== ChatRole.OWNER && chatUser.role !== ChatRole.MODERATOR) {
			throw new Error('Only chat owner or moderator can remove members');
		}

		// Remove duplicates and current user from userIds
		const uniqueUserIds = [...new Set(userIds.filter(id => id !== userId))];

		if (uniqueUserIds.length === 0) {
			throw new Error('Cannot remove yourself. Use delete chat to leave the group');
		}

		// Check if users exist
		const users = await prisma.user.findMany({
			where: {
				id: { in: uniqueUserIds },
				deletedAt: null,
			},
		});

		if (users.length !== uniqueUserIds.length) {
			throw new Error('Some users not found');
		}

		// Get chat users to remove
		const chatUsersToRemove = await prisma.chatUser.findMany({
			where: {
				chatId,
				userId: { in: uniqueUserIds },
				deletedAt: null,
			},
		});

		if (chatUsersToRemove.length === 0) {
			throw new Error('No valid members to remove');
		}

		// Check if trying to remove members who are not in the chat
		if (chatUsersToRemove.length !== uniqueUserIds.length) {
			throw new Error('Some users are not members of this chat');
		}

		// Check if trying to remove OWNER
		const ownerToRemove = chatUsersToRemove.find(cu => cu.role === ChatRole.OWNER);
		if (ownerToRemove) {
			throw new Error('Cannot remove chat owner');
		}

		// If current user is MODERATOR, check if trying to remove another MODERATOR
		if (chatUser.role === ChatRole.MODERATOR) {
			const moderatorToRemove = chatUsersToRemove.find(cu => cu.role === ChatRole.MODERATOR);
			if (moderatorToRemove) {
				throw new Error('Moderator cannot remove other moderators');
			}
		}

		// Remove members from the chat (soft delete)
		await prisma.chatUser.updateMany({
			where: {
				id: { in: chatUsersToRemove.map(cu => cu.id) },
			},
			data: {
				deletedAt: new Date(),
				updatedBy: userId,
			},
		});

		// Return updated chat
		const updatedChat = await this.getChatById(userId, chatId);
		return updatedChat;
	}

	/**
	 * Updates a member's role in a group chat
	 * Only OWNER can change roles
	 * Cannot change own role
	 * If promoting someone to OWNER, current OWNER becomes MODERATOR
	 */
	async updateChatMemberRole(
		userId: string,
		chatId: string,
		targetUserId: string,
		newRole: ChatRole,
	): Promise<ChatResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
			include: {
				chat: {
					include: {
						chatUsers: {
							where: {
								deletedAt: null,
							},
						},
					},
				},
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Check if it's a group chat
		if (!chatUser.chat.isGroup) {
			throw new Error('Cannot change roles in 1-on-1 chat');
		}

		// Check if user has permission to change roles (must be OWNER)
		if (chatUser.role !== ChatRole.OWNER) {
			throw new Error('Only chat owner can change member roles');
		}

		// Cannot change own role
		if (userId === targetUserId) {
			throw new Error('Cannot change your own role');
		}

		// Check if target user is a member of the chat
		const targetChatUser = await prisma.chatUser.findFirst({
			where: {
				userId: targetUserId,
				chatId,
				deletedAt: null,
			},
		});

		if (!targetChatUser) {
			throw new Error('Target user is not a member of this chat');
		}

		// If promoting to OWNER, demote current OWNER to MODERATOR
		if (newRole === ChatRole.OWNER) {
			await prisma.$transaction([
				// Demote current OWNER to MODERATOR
				prisma.chatUser.update({
					where: {
						id: chatUser.id,
					},
					data: {
						role: ChatRole.MODERATOR,
						updatedBy: userId,
					},
				}),
				// Promote target user to OWNER
				prisma.chatUser.update({
					where: {
						id: targetChatUser.id,
					},
					data: {
						role: newRole,
						updatedBy: userId,
					},
				}),
			]);
		} else {
			// Update target user's role
			await prisma.chatUser.update({
				where: {
					id: targetChatUser.id,
				},
				data: {
					role: newRole,
					updatedBy: userId,
				},
			});
		}

		// Return updated chat
		const updatedChat = await this.getChatById(userId, chatId);
		return updatedChat;
	}
}
