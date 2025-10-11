import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { ChatService } from '../services/chatService';
import {
	createChatSchema,
	updateChatSchema,
	addChatMembersSchema,
	removeChatMembersSchema,
} from '../utils/validationSchemas';
import { ZodError } from 'zod';

const chatService = new ChatService();

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
	} catch (error) {
		next(error);
	}
}
