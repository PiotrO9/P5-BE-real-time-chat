import { PrismaClient } from '@prisma/client';
import { MessageResponse, MessagesListResponse } from '../types/message';

const prisma = new PrismaClient();

export class MessageService {
	/**
	 * Helper method to filter reads to only include users for whom this is their latest read message
	 */
	private async filterLatestReads(
		chatId: string,
		messageId: string,
		reads: Array<{ userId: string; username: string; readAt: Date }>,
		chatUsersCache?: Array<{ userId: string; lastReadMessageId: string | null }>,
	): Promise<Array<{ userId: string; username: string; readAt: Date }>> {
		// Get all chat users with their last read message IDs (use cache if provided)
		let chatUsers: Array<{ userId: string; lastReadMessageId: string | null }>;
		if (chatUsersCache) {
			chatUsers = chatUsersCache;
		} else {
			chatUsers = await prisma.chatUser.findMany({
				where: {
					chatId,
					deletedAt: null,
				},
				select: {
					userId: true,
					lastReadMessageId: true,
				},
			});
		}

		// Create a set of userIds for whom this is their latest read message
		const latestReadUserIds = new Set<string>();
		chatUsers.forEach(chatUser => {
			if (chatUser.lastReadMessageId === messageId) {
				latestReadUserIds.add(chatUser.userId);
			}
		});

		// Filter reads to only show users who have this as their latest read message
		return reads.filter(read => latestReadUserIds.has(read.userId));
	}
	/**
	 * Gets messages from a chat with pagination
	 */
	async getMessages(
		userId: string,
		chatId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<MessagesListResponse> {
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
				createdAt: 'asc',
			},
			skip: offset,
			take: limit + 1,
		});

		const hasMore = messages.length > limit;
		const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

		if (messagesToReturn.length > 0) {
			const newestMessage = messagesToReturn[messagesToReturn.length - 1];

			if (newestMessage.senderId !== userId) {
				const readAt = new Date();

				await prisma.chatUser.update({
					where: {
						userId_chatId: {
							userId,
							chatId,
						},
					},
					data: {
						lastReadMessageId: newestMessage.id,
						lastReadAt: readAt,
					},
				});

				// Create or update MessageRead record for the newest message
				await prisma.messageRead.upsert({
					where: {
						messageId_userId: {
							messageId: newestMessage.id,
							userId,
						},
					},
					create: {
						messageId: newestMessage.id,
						userId,
						readAt,
						createdBy: userId,
					},
					update: {
						readAt,
						deletedAt: null,
						updatedBy: userId,
					},
				});
			}
		}

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

		const total = await prisma.message.count({
			where: {
				chatId,
				deletedAt: null,
			},
		});

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

		// Get all chat users with their last read message IDs (for filtering reads)
		const chatUsers = await prisma.chatUser.findMany({
			where: {
				chatId,
				deletedAt: null,
			},
			select: {
				userId: true,
				lastReadMessageId: true,
			},
		});

		const formattedMessages: MessageResponse[] = await Promise.all(
			messagesToReturn.map(async message => {
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

				// Filter reads to only show users who have this as their latest read message
				const readsData = message.reads.map(read => ({
					userId: read.userId,
					username: read.user.username,
					readAt: read.readAt,
				}));
				const filteredReads = await this.filterLatestReads(chatId, message.id, readsData, chatUsers);

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
					reads: filteredReads.length > 0 ? filteredReads : undefined,
					isPinned: pinnedMessageIds.has(message.id),
				};
			}),
		);

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

		const createdMessage = await prisma.message.create({
			data: {
				chatId,
				senderId: userId,
				content,
				replyToId: replyToId || null,
				createdBy: userId,
			},
		});

		await prisma.chat.update({
			where: {
				id: chatId,
			},
			data: {
				updatedBy: userId,
				updatedAt: new Date(),
			},
		});

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

		const readsData = message.reads.map(read => ({
			userId: read.userId,
			username: read.user.username,
			readAt: read.readAt,
		}));
		const filteredReads = await this.filterLatestReads(message.chatId, message.id, readsData);

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
			reads: filteredReads.length > 0 ? filteredReads : undefined,
			isPinned: false,
		};
	}

	/**
	 * Edits a message
	 */
	async editMessage(userId: string, messageId: string, content: string): Promise<MessageResponse> {
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

		const now = new Date();
		const messageAge = now.getTime() - message.createdAt.getTime();
		const tenMinutesInMs = 10 * 60 * 1000;

		if (messageAge > tenMinutesInMs) {
			throw new Error(
				'Message is too old to be edited. You can only edit messages within 10 minutes of creation.',
			);
		}

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

		const pinnedMessage = await prisma.pinnedMessage.findFirst({
			where: {
				chatId: updatedMessage.chatId,
				messageId: updatedMessage.id,
				deletedAt: null,
			},
		});

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

		const readsData = updatedMessage.reads.map(read => ({
			userId: read.userId,
			username: read.user.username,
			readAt: read.readAt,
		}));
		const filteredReads = await this.filterLatestReads(
			updatedMessage.chatId,
			updatedMessage.id,
			readsData,
		);

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
			reads: filteredReads.length > 0 ? filteredReads : undefined,
			isPinned: !!pinnedMessage,
		};
	}

	/**
	 * Deletes a message (soft delete)
	 */
	async deleteMessage(userId: string, messageId: string): Promise<void> {
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
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

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

		const formattedReplies = await Promise.all(
			replies.map(async reply => {
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

				const readsData = reply.reads.map(read => ({
					userId: read.userId,
					username: read.user.username,
					readAt: read.readAt,
				}));
				const filteredReads = await this.filterLatestReads(reply.chatId, reply.id, readsData);

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
					reads: filteredReads.length > 0 ? filteredReads : undefined,
					isPinned: pinnedMessageIds.has(reply.id),
				};
			}),
		);

		return formattedReplies;
	}

	/**
	 * Adds a reaction to a message
	 */
	async addMessageReaction(userId: string, messageId: string, emoji: string): Promise<void> {
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

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

		const existingReaction = await prisma.messageReaction.findFirst({
			where: {
				messageId,
				userId,
				emoji,
			},
		});

		if (existingReaction) {
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
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

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

		if (message.senderId === userId) {
			return;
		}

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

		const shouldUpdate =
			!currentChatUser?.lastReadMessage ||
			message.createdAt > currentChatUser.lastReadMessage.createdAt;

		if (shouldUpdate) {
			const readAt = new Date();

			await prisma.chatUser.update({
				where: {
					userId_chatId: {
						userId,
						chatId: message.chatId,
					},
				},
				data: {
					lastReadMessageId: messageId,
					lastReadAt: readAt,
				},
			});

			// Create or update MessageRead record
			await prisma.messageRead.upsert({
				where: {
					messageId_userId: {
						messageId,
						userId,
					},
				},
				create: {
					messageId,
					userId,
					readAt,
					createdBy: userId,
				},
				update: {
					readAt,
					deletedAt: null,
					updatedBy: userId,
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
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				deletedAt: null,
			},
		});

		if (!message) {
			throw new Error('Message not found');
		}

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
