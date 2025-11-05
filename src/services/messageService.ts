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

		// Get messages from the chat
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
			take: limit + 1, // Take one more to check if there are more messages
		});

		const hasMore = messages.length > limit;
		const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

		// Mark all fetched messages as read (except user's own messages)
		const messageIdsToMarkAsRead = messagesToReturn
			.filter(message => message.senderId !== userId)
			.map(message => message.id);

		// Get user data for read records
		let userUsername: string | null = null;
		if (messageIdsToMarkAsRead.length > 0) {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { username: true },
			});
			userUsername = user?.username || null;

			// Get existing read records
			const existingReads = await prisma.messageRead.findMany({
				where: {
					messageId: { in: messageIdsToMarkAsRead },
					userId,
					deletedAt: null,
				},
				select: {
					messageId: true,
				},
			});

			const existingReadMessageIds = new Set(existingReads.map(r => r.messageId));

			// Create read records for messages that haven't been read yet
			const messagesToCreateRead = messageIdsToMarkAsRead.filter(
				id => !existingReadMessageIds.has(id),
			);

			if (messagesToCreateRead.length > 0) {
				await prisma.messageRead.createMany({
					data: messagesToCreateRead.map(messageId => ({
						messageId,
						userId,
						createdBy: userId,
					})),
					skipDuplicates: true,
				});

				// Add newly created read records to the messages
				if (userUsername) {
					const now = new Date();
					messagesToReturn.forEach(message => {
						if (messagesToCreateRead.includes(message.id)) {
							message.reads.push({
								id: '',
								messageId: message.id,
								userId,
								readAt: now,
								deletedAt: null,
								createdBy: userId,
								updatedBy: null,
								user: {
									username: userUsername!,
								},
							});
						}
					});
				}
			}
		}

		// Get total count of messages
		const total = await prisma.message.count({
			where: {
				chatId,
				deletedAt: null,
			},
		});

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
			};
		});

		return {
			messages: formattedMessages,
			total,
			hasMore,
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

		// Update the message
		const updatedMessage = await prisma.message.update({
			where: {
				id: messageId,
			},
			data: {
				content,
				wasUpdated: true,
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

		// Check if read record already exists
		const existingRead = await prisma.messageRead.findFirst({
			where: {
				messageId,
				userId,
			},
		});

		if (existingRead) {
			// If it was soft-deleted, restore it
			if (existingRead.deletedAt) {
				await prisma.messageRead.update({
					where: {
						id: existingRead.id,
					},
					data: {
						deletedAt: null,
						readAt: new Date(),
						updatedBy: userId,
					},
				});
			}
			// If already marked as read, do nothing
		} else {
			// Create new read record
			await prisma.messageRead.create({
				data: {
					messageId,
					userId,
					createdBy: userId,
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
