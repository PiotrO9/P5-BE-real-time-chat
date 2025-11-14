import { PrismaClient } from '@prisma/client';
import { MessageResponse, MessagesListResponse } from '../types/message';

const prisma = new PrismaClient();

export class MessageService {
	/**
	 * Gets messages from a chat with pagination
	 */
	async getMessages(
		userId: string,
		chatId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<MessagesListResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Get messages from the chat (najnowsze pierwsze)
		const messages = await prisma.message.findMany({
			where: {
				chatId,
				deletedAt: null,
			},
			include: {
				sender: {
					select: {
						username: true,
					},
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						sender: {
							select: {
								username: true,
							},
						},
					},
				},
				reactions: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								id: true,
							},
						},
					},
				},
				reads: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								username: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: 'desc', // Najnowsze pierwsze
			},
			skip: offset,
			take: limit + 1, // Take one more to check if there are more messages
		});

		const hasMore = messages.length > limit;
		const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

		// Znajdź najnowszą wiadomość (pierwsza w tablicy, bo sort desc)
		// i zaktualizuj lastReadMessageId w ChatUser
		if (messagesToReturn.length > 0) {
			const newestMessage = messagesToReturn[0];

			// Oznacz jako przeczytane tylko jeśli to nie jest własna wiadomość użytkownika
			if (newestMessage.senderId !== userId) {
				await prisma.chatUser.update({
					where: {
						userId_chatId: {
							userId,
							chatId,
						},
					},
					data: {
						lastReadMessageId: newestMessage.id,
						lastReadAt: new Date(),
					},
				});
			}
		}

		// Pobierz lastReadMessageId dla użytkownika (do zwrócenia na frontend)
		const chatUserWithLastRead = await prisma.chatUser.findUnique({
			where: {
				userId_chatId: {
					userId,
					chatId,
				},
			},
			select: {
				lastReadMessageId: true,
			},
		});

		// Get total count of messages
		const total = await prisma.message.count({
			where: {
				chatId,
				deletedAt: null,
			},
		});

		// Get all pinned messages for this chat
		const pinnedMessages = await prisma.pinnedMessage.findMany({
			where: {
				chatId,
				deletedAt: null,
			},
			select: {
				messageId: true,
			},
		});

		const pinnedMessageIds = new Set(pinnedMessages.map(pm => pm.messageId));

		// Format messages
		const formattedMessages: MessageResponse[] = messagesToReturn.map(message => {
			// Group reactions by emoji
			const reactionsMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();

			message.reactions.forEach(reaction => {
				const existing = reactionsMap.get(reaction.emoji);
				if (existing) {
					existing.count++;
					existing.userIds.push(reaction.user.id);
				} else {
					reactionsMap.set(reaction.emoji, {
						emoji: reaction.emoji,
						count: 1,
						userIds: [reaction.user.id],
					});
				}
			});

			return {
				id: message.id,
				chatId: message.chatId,
				senderId: message.senderId,
				senderUsername: message.sender.username,
				content: message.content,
				wasUpdated: message.wasUpdated,
				editedAt: message.editedAt,
				createdAt: message.createdAt,
				updatedAt: message.updatedAt,
				replyTo: message.replyTo
					? {
							id: message.replyTo.id,
							content: message.replyTo.content,
							senderUsername: message.replyTo.sender.username,
					  }
					: null,
				reactions: Array.from(reactionsMap.values()),
				reads: message.reads.map(read => ({
					userId: read.userId,
					username: read.user.username,
					readAt: read.readAt,
				})),
				isPinned: pinnedMessageIds.has(message.id),
			};
		});

		return {
			messages: formattedMessages,
			total,
			hasMore,
			lastReadMessageId: chatUserWithLastRead?.lastReadMessageId || null,
		};
	}

	/**
	 * Sends a message to a chat
	 */
	async sendMessage(
		userId: string,
		chatId: string,
		content: string,
		replyToId?: string,
	): Promise<MessageResponse> {
		// Check if user is a member of this chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// If replyToId is provided, check if the message exists in this chat
		if (replyToId) {
			const replyToMessage = await prisma.message.findFirst({
				where: {
					id: replyToId,
					chatId,
					deletedAt: null,
				},
			});

			if (!replyToMessage) {
				throw new Error('Reply message not found in this chat');
			}
		}

		// Create the message
		const createdMessage = await prisma.message.create({
			data: {
				chatId,
				senderId: userId,
				content,
				replyToId: replyToId || null,
				createdBy: userId,
			},
		});

		// Update chat's updatedAt timestamp
		await prisma.chat.update({
			where: {
				id: chatId,
			},
			data: {
				updatedBy: userId,
				updatedAt: new Date(), // Explicitly update to ensure timestamp is refreshed
			},
		});

		// Fetch the message with all relations to ensure consistency with getMessages
		const message = await prisma.message.findUnique({
			where: {
				id: createdMessage.id,
			},
			include: {
				sender: {
					select: {
						username: true,
					},
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						sender: {
							select: {
								username: true,
							},
						},
					},
				},
				reactions: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								id: true,
							},
						},
					},
				},
				reads: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								username: true,
							},
						},
					},
				},
			},
		});

		if (!message) {
			throw new Error('Failed to retrieve created message');
		}

		// Group reactions by emoji
		const reactionsMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();

		message.reactions.forEach(reaction => {
			const existing = reactionsMap.get(reaction.emoji);
			if (existing) {
				existing.count++;
				existing.userIds.push(reaction.user.id);
			} else {
				reactionsMap.set(reaction.emoji, {
					emoji: reaction.emoji,
					count: 1,
					userIds: [reaction.user.id],
				});
			}
		});

		return {
			id: message.id,
			chatId: message.chatId,
			senderId: message.senderId,
			senderUsername: message.sender.username,
			content: message.content,
			wasUpdated: message.wasUpdated,
			editedAt: message.editedAt,
			createdAt: message.createdAt,
			updatedAt: message.updatedAt,
			replyTo: message.replyTo
				? {
						id: message.replyTo.id,
						content: message.replyTo.content,
						senderUsername: message.replyTo.sender.username,
				  }
				: null,
			reactions: Array.from(reactionsMap.values()),
			reads: message.reads.map(read => ({
				userId: read.userId,
				username: read.user.username,
				readAt: read.readAt,
			})),
			isPinned: false, // New message cannot be pinned immediately
		};
	}

	/**
	 * Edits a message
	 */
	async editMessage(userId: string, messageId: string, content: string): Promise<MessageResponse> {
		// Check if message exists and belongs to the user
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				senderId: userId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found or you are not the sender');
		}

		// Check if message is older than 10 minutes
		const now = new Date();
		const messageAge = now.getTime() - message.createdAt.getTime();
		const tenMinutesInMs = 10 * 60 * 1000;

		if (messageAge > tenMinutesInMs) {
			throw new Error(
				'Message is too old to be edited. You can only edit messages within 10 minutes of creation.',
			);
		}

		// Update the message
		const updatedMessage = await prisma.message.update({
			where: {
				id: messageId,
			},
			data: {
				content,
				wasUpdated: true,
				editedAt: now,
				updatedBy: userId,
			},
			include: {
				sender: {
					select: {
						username: true,
					},
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						sender: {
							select: {
								username: true,
							},
						},
					},
				},
				reactions: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								id: true,
							},
						},
					},
				},
				reads: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								username: true,
							},
						},
					},
				},
			},
		});

		// Check if message is pinned
		const pinnedMessage = await prisma.pinnedMessage.findFirst({
			where: {
				chatId: updatedMessage.chatId,
				messageId: updatedMessage.id,
				deletedAt: null,
			},
		});

		// Group reactions by emoji
		const reactionsMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();

		updatedMessage.reactions.forEach(reaction => {
			const existing = reactionsMap.get(reaction.emoji);
			if (existing) {
				existing.count++;
				existing.userIds.push(reaction.user.id);
			} else {
				reactionsMap.set(reaction.emoji, {
					emoji: reaction.emoji,
					count: 1,
					userIds: [reaction.user.id],
				});
			}
		});

		return {
			id: updatedMessage.id,
			chatId: updatedMessage.chatId,
			senderId: updatedMessage.senderId,
			senderUsername: updatedMessage.sender.username,
			content: updatedMessage.content,
			wasUpdated: updatedMessage.wasUpdated,
			editedAt: updatedMessage.editedAt,
			createdAt: updatedMessage.createdAt,
			updatedAt: updatedMessage.updatedAt,
			replyTo: updatedMessage.replyTo
				? {
						id: updatedMessage.replyTo.id,
						content: updatedMessage.replyTo.content,
						senderUsername: updatedMessage.replyTo.sender.username,
				  }
				: null,
			reactions: Array.from(reactionsMap.values()),
			reads: updatedMessage.reads.map(read => ({
				userId: read.userId,
				username: read.user.username,
				readAt: read.readAt,
			})),
			isPinned: !!pinnedMessage,
		};
	}

	/**
	 * Deletes a message (soft delete)
	 */
	async deleteMessage(userId: string, messageId: string): Promise<void> {
		// Check if message exists and belongs to the user
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				senderId: userId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found or you are not the sender');
		}

		// Soft delete the message
		await prisma.message.update({
			where: {
				id: messageId,
			},
			data: {
				deletedAt: new Date(),
				updatedBy: userId,
			},
		});
	}

	/**
	 * Gets replies to a message
	 */
	async getMessageReplies(userId: string, messageId: string): Promise<MessageResponse[]> {
		// Check if message exists
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

		// Check if user is a member of the chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId: message.chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Get replies
		const replies = await prisma.message.findMany({
			where: {
				replyToId: messageId,
				deletedAt: null,
			},
			include: {
				sender: {
					select: {
						username: true,
					},
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						sender: {
							select: {
								username: true,
							},
						},
					},
				},
				reactions: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								id: true,
							},
						},
					},
				},
				reads: {
					where: {
						deletedAt: null,
					},
					include: {
						user: {
							select: {
								username: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: 'asc',
			},
		});

		// Get all pinned messages for this chat
		const pinnedMessages = await prisma.pinnedMessage.findMany({
			where: {
				chatId: message.chatId,
				deletedAt: null,
			},
			select: {
				messageId: true,
			},
		});

		const pinnedMessageIds = new Set(pinnedMessages.map(pm => pm.messageId));

		// Format replies
		return replies.map(reply => {
			// Group reactions by emoji
			const reactionsMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();

			reply.reactions.forEach(reaction => {
				const existing = reactionsMap.get(reaction.emoji);
				if (existing) {
					existing.count++;
					existing.userIds.push(reaction.user.id);
				} else {
					reactionsMap.set(reaction.emoji, {
						emoji: reaction.emoji,
						count: 1,
						userIds: [reaction.user.id],
					});
				}
			});

			return {
				id: reply.id,
				chatId: reply.chatId,
				senderId: reply.senderId,
				senderUsername: reply.sender.username,
				content: reply.content,
				wasUpdated: reply.wasUpdated,
				editedAt: reply.editedAt,
				createdAt: reply.createdAt,
				updatedAt: reply.updatedAt,
				replyTo: reply.replyTo
					? {
							id: reply.replyTo.id,
							content: reply.replyTo.content,
							senderUsername: reply.replyTo.sender.username,
					  }
					: null,
				reactions: Array.from(reactionsMap.values()),
				reads: reply.reads.map(read => ({
					userId: read.userId,
					username: read.user.username,
					readAt: read.readAt,
				})),
				isPinned: pinnedMessageIds.has(reply.id),
			};
		});
	}

	/**
	 * Adds a reaction to a message
	 */
	async addMessageReaction(userId: string, messageId: string, emoji: string): Promise<void> {
		// Check if message exists
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

		// Check if user is a member of the chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId: message.chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Check if reaction already exists
		const existingReaction = await prisma.messageReaction.findFirst({
			where: {
				messageId,
				userId,
				emoji,
			},
		});

		if (existingReaction) {
			// If it was soft-deleted, restore it
			if (existingReaction.deletedAt) {
				await prisma.messageReaction.update({
					where: {
						id: existingReaction.id,
					},
					data: {
						deletedAt: null,
						updatedBy: userId,
					},
				});
			} else {
				throw new Error('You have already reacted with this emoji');
			}
		} else {
			// Create new reaction
			await prisma.messageReaction.create({
				data: {
					messageId,
					userId,
					emoji,
					createdBy: userId,
				},
			});
		}
	}

	/**
	 * Removes a reaction from a message
	 */
	async deleteMessageReaction(userId: string, messageId: string, emoji: string): Promise<void> {
		// Check if reaction exists
		const reaction = await prisma.messageReaction.findFirst({
			where: {
				messageId,
				userId,
				emoji,
				deletedAt: null,
			},
		});

		if (!reaction) {
			throw new Error('Reaction not found');
		}

		// Soft delete the reaction
		await prisma.messageReaction.update({
			where: {
				id: reaction.id,
			},
			data: {
				deletedAt: new Date(),
				updatedBy: userId,
			},
		});
	}

	/**
	 * Marks a message as read
	 */
	async markMessageAsRead(userId: string, messageId: string): Promise<void> {
		// Check if message exists
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

		// Check if user is a member of the chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId: message.chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Don't mark own messages as read
		if (message.senderId === userId) {
			return;
		}

		// Get current lastReadMessage to check if we need to update
		const currentChatUser = await prisma.chatUser.findUnique({
			where: {
				userId_chatId: {
					userId,
					chatId: message.chatId,
				},
			},
			select: {
				lastReadMessage: {
					select: {
						createdAt: true,
					},
				},
			},
		});

		// Update lastReadMessageId only if this message is newer than current lastReadMessage
		const shouldUpdate =
			!currentChatUser?.lastReadMessage ||
			message.createdAt > currentChatUser.lastReadMessage.createdAt;

		if (shouldUpdate) {
			await prisma.chatUser.update({
				where: {
					userId_chatId: {
						userId,
						chatId: message.chatId,
					},
				},
				data: {
					lastReadMessageId: messageId,
					lastReadAt: new Date(),
				},
			});
		}
	}

	/**
	 * Gets list of users who read a message
	 */
	async getMessageReaders(
		userId: string,
		messageId: string,
	): Promise<{ userId: string; username: string; readAt: Date }[]> {
		// Check if message exists
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

		// Check if user is a member of the chat
		const chatUser = await prisma.chatUser.findFirst({
			where: {
				userId,
				chatId: message.chatId,
				deletedAt: null,
			},
		});

		if (!chatUser) {
			throw new Error('Chat not found or you are not a member of this chat');
		}

		// Get all reads for this message
		const reads = await prisma.messageRead.findMany({
			where: {
				messageId,
				deletedAt: null,
			},
			include: {
				user: {
					select: {
						username: true,
					},
				},
			},
			orderBy: {
				readAt: 'desc',
			},
		});

		return reads.map(read => ({
			userId: read.userId,
			username: read.user.username,
			readAt: read.readAt,
		}));
	}
}
