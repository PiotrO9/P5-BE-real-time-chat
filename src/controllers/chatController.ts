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

		// Validate request body
		try {
			const validatedData = createChatSchema.parse(req.body);

			// Create chat
			const chat = await chatService.createChat(userId, validatedData);

			// Get all participant IDs for socket emission
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

			// Emit socket event to all participants
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

			// Update chat
			const updatedChat = await chatService.updateChat(userId, chatId, validatedData.name);

			// Emit socket event to all chat members
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

		// Validate request body
		try {
			const validatedData = addChatMembersSchema.parse(req.body);

			// Add members to chat
			const updatedChat = await chatService.addChatMembers(userId, chatId, validatedData.userIds);

			// Emit socket event for each new member
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

		// Validate request body
		try {
			const validatedData = removeChatMembersSchema.parse(req.body);

			// Remove members from chat
			const updatedChat = await chatService.removeChatMembers(userId, chatId, validatedData.userIds);

			// Emit socket event for each removed member
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

		// Validate request body
		try {
			const validatedData = updateChatMemberRoleSchema.parse(req.body);

			// Update member role
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
