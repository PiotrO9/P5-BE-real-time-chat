import { PrismaClient } from '@prisma/client';
import { ChatResponse, ChatsListResponse, LastMessage, ChatMember } from '../types/chat';

const prisma = new PrismaClient();

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
}
