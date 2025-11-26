import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { ChatService } from '../services/chatService';
import {
	createChatSchema,
	updateChatSchema,
	addChatMembersSchema,
	removeChatMembersSchema,
	updateChatMemberRoleSchema,
} from '../utils/validationSchemas';
import { ZodError } from 'zod';
import {
	emitChatCreated,
	emitChatUpdated,
	emitMemberAdded,
	emitMemberRemoved,
	emitMessagePinned,
	emitMessageUnpinned,
} from '../socket/socketEmitters';
import { PrismaClient } from '@prisma/client';

const chatService = new ChatService();
const prisma = new PrismaClient();

/**
 * Get all chats for current user
 * GET /api/chats
 */
export async function getChats(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatsData = await chatService.getChats(userId);

		ResponseHelper.success(res, 'Chats retrieved successfully', chatsData);
	} catch (error) {
		next(error);
	}
}

/**
 * Create a new chat (1-on-1 or group)
 * POST /api/chats
 * Body: { participantId: string } for 1-on-1 chat
 *       { name: string, participantIds: string[] } for group chat
 */
export async function createChat(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		try {
			const validatedData = createChatSchema.parse(req.body);

			const chat = await chatService.createChat(userId, validatedData);

			const chatUsers = await prisma.chatUser.findMany({
				where: {
					chatId: chat.id,
					deletedAt: null,
				},
				select: {
					userId: true,
				},
			});

			const participantIds = chatUsers.map(cu => cu.userId);

			emitChatCreated(chat, participantIds);

			ResponseHelper.success(res, 'Chat created successfully', chat, 201);
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
				}));
				ResponseHelper.error(res, 'Validation failed', 400, errors);
				return;
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
}

/**
 * Get a specific chat by ID
 * GET /api/chats/:id
 */
export async function getChat(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		const chatService = new ChatService();
		const chat = await chatService.getChatById(userId, chatId);

		ResponseHelper.success(res, 'Chat retrieved successfully', chat);
	} catch (error) {
		next(error);
	}
}

/**
 * Delete a chat by ID
 * DELETE /api/chats/:id
 */
export async function deleteChat(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		await chatService.deleteChat(userId, chatId);

		ResponseHelper.success(res, 'Chat deleted successfully');
	} catch (error) {
		next(error);
	}
}

/**
 * Update a chat by ID
 * PATCH /api/chats/:id
 */
export async function updateChat(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		// Validate request body
		try {
			const validatedData = updateChatSchema.parse(req.body);

			const updatedChat = await chatService.updateChat(userId, chatId, validatedData.name);

			emitChatUpdated(chatId, { name: validatedData.name });

			ResponseHelper.success(res, 'Chat updated successfully', updatedChat);
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
				}));
				ResponseHelper.error(res, 'Validation failed', 400, errors);
				return;
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
}

/**
 * Add members to a chat
 * POST /api/chats/:id/members
 */
export async function addChatMembers(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		try {
			const validatedData = addChatMembersSchema.parse(req.body);

			const updatedChat = await chatService.addChatMembers(userId, chatId, validatedData.userIds);

			for (const newUserId of validatedData.userIds) {
				const user = await prisma.user.findUnique({
					where: { id: newUserId },
					select: { username: true },
				});

				if (user) {
					emitMemberAdded(chatId, {
						userId: newUserId,
						username: user.username,
					});
				}
			}

			ResponseHelper.success(res, 'Members added successfully', updatedChat);
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
				}));
				ResponseHelper.error(res, 'Validation failed', 400, errors);
				return;
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
}

/**
 * Remove members from a chat
 * DELETE /api/chats/:id/members
 */
export async function removeChatMembers(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		try {
			const validatedData = removeChatMembersSchema.parse(req.body);

			const updatedChat = await chatService.removeChatMembers(userId, chatId, validatedData.userIds);

			for (const removedUserId of validatedData.userIds) {
				emitMemberRemoved(chatId, removedUserId);
			}

			ResponseHelper.success(res, 'Members removed successfully', updatedChat);
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
				}));
				ResponseHelper.error(res, 'Validation failed', 400, errors);
				return;
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
}

/**
 * Update a chat member's role
 * PATCH /api/chats/:id/members/:userId/role
 */
export async function updateChatMembersRole(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;
		const targetUserId = req.params.userId;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		if (!targetUserId) {
			ResponseHelper.error(res, 'User ID is required', 400);
			return;
		}

		try {
			const validatedData = updateChatMemberRoleSchema.parse(req.body);

			const updatedChat = await chatService.updateChatMemberRole(
				userId,
				chatId,
				targetUserId,
				validatedData.role as any,
			);

			ResponseHelper.success(res, 'Member role updated successfully', updatedChat);
		} catch (error) {
			if (error instanceof ZodError) {
				const errors = error.issues.map((err: any) => ({
					field: err.path.join('.'),
					message: err.message,
				}));
				ResponseHelper.error(res, 'Validation failed', 400, errors);
				return;
			}
			throw error;
		}
	} catch (error) {
		next(error);
	}
}

/**
 * Get pinned messages for a chat
 * GET /api/chats/:chatId/pinned
 */
export async function getPinnedMessages(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		const pinnedMessages = await chatService.getPinnedMessages(userId, chatId);

		ResponseHelper.success(res, 'Pinned messages retrieved successfully', { pinnedMessages });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Pin a message in a chat
 * POST /api/chats/:chatId/pin/:messageId
 */
export async function pinMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;
		const messageId = req.params.messageId;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		if (!messageId) {
			ResponseHelper.error(res, 'Message ID is required', 400);
			return;
		}

		const pinnedMessage = await chatService.pinMessage(userId, chatId, messageId);

		emitMessagePinned(chatId, pinnedMessage);

		ResponseHelper.success(res, 'Message pinned successfully', pinnedMessage, 201);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Message not found in this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Message is already pinned') {
				ResponseHelper.error(res, error.message, 400);
				return;
			}
		}
		next(error);
	}
}

/**
 * Unpin a message from a chat
 * DELETE /api/chats/:chatId/unpin/:messageId
 */
export async function unpinMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const chatId = req.params.id;
		const messageId = req.params.messageId;

		if (!chatId) {
			ResponseHelper.error(res, 'Chat ID is required', 400);
			return;
		}

		if (!messageId) {
			ResponseHelper.error(res, 'Message ID is required', 400);
			return;
		}

		const result = await chatService.unpinMessage(userId, chatId, messageId);

		emitMessageUnpinned(chatId, messageId);

		ResponseHelper.success(res, 'Message unpinned successfully', result);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Message is not pinned') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}
