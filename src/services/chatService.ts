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
	 * Deletes a chat for a user (soft delete)
	 * For 1-on-1 chats: removes user from chat
	 * For group chats: removes user from chat, if last member or owner, deletes entire chat
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
		const activeMembersCount = chat.chatUsers.length;

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

		// For group chats
		// If user is the last member or the only member left, delete the entire chat
		if (activeMembersCount === 1) {
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
			return;
		}

		// If user is OWNER and there are other members
		if (chatUser.role === ChatRole.OWNER) {
			// Find another member to promote to owner
			const newOwner = chat.chatUsers.find(cu => cu.userId !== userId && cu.deletedAt === null);

			if (newOwner) {
				await prisma.$transaction([
					// Promote new owner
					prisma.chatUser.update({
						where: {
							id: newOwner.id,
						},
						data: {
							role: ChatRole.OWNER,
							updatedBy: userId,
						},
					}),
					// Remove current user from chat
					prisma.chatUser.update({
						where: {
							id: chatUser.id,
						},
						data: {
							deletedAt: new Date(),
							updatedBy: userId,
						},
					}),
				]);
				return;
			}
		}

		// If user is not owner or owner role was transferred, just remove user from chat
		await prisma.chatUser.update({
			where: {
				id: chatUser.id,
			},
			data: {
				deletedAt: new Date(),
				updatedBy: userId,
			},
		});
	}
}
