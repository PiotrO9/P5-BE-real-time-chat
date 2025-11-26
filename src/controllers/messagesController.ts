import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { MessageService } from '../services/messageService';
import {
	getMessagesQuerySchema,
	sendMessageSchema,
	editMessageSchema,
	addMessageReactionSchema,
	forwardMessageSchema,
} from '../utils/validationSchemas';
import {
	emitNewMessage,
	emitMessageUpdated,
	emitMessageDeleted,
	emitReactionAdded,
	emitReactionRemoved,
	emitMessageRead,
} from '../socket/socketEmitters';
import { PrismaClient } from '@prisma/client';

const messageService = new MessageService();
const prisma = new PrismaClient();

/**
 * Get all messages for a specific chat
 * GET /api/messages/:chatId/messages
 */
export async function getMessages(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;

		const queryValidation = getMessagesQuerySchema.safeParse(req.query);

		if (!queryValidation.success) {
			const errors = queryValidation.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			ResponseHelper.validationError(res, errors);
			return;
		}

		const { limit, offset } = queryValidation.data;

		const result = await messageService.getMessages(userId, chatId, limit, offset);

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		if (user && result.lastReadMessageId && result.messages.length > 0) {
			const lastReadMessage = result.messages.find(m => m.id === result.lastReadMessageId);

			if (lastReadMessage && lastReadMessage.senderId !== userId) {
				emitMessageRead(chatId, result.lastReadMessageId, {
					userId,
					username: user.username,
					readAt: new Date(),
				});
			}
		}

		ResponseHelper.success(res, 'Messages retrieved successfully', result);
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
 * Send a new message to a chat
 * POST /api/messages/:chatId/messages
 */
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;

		const bodyValidation = sendMessageSchema.safeParse(req.body);

		if (!bodyValidation.success) {
			const errors = bodyValidation.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			ResponseHelper.validationError(res, errors);
			return;
		}

		const { content, replyToId } = bodyValidation.data;

		const message = await messageService.sendMessage(userId, chatId, content, replyToId);

		emitNewMessage(chatId, message);

		ResponseHelper.success(res, 'Message sent successfully', message, 201);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Reply message not found in this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Edit a message by ID
 * PATCH /api/messages/:messageId
 */
export async function editMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		const bodyValidation = editMessageSchema.safeParse(req.body);

		if (!bodyValidation.success) {
			const errors = bodyValidation.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			ResponseHelper.validationError(res, errors);
			return;
		}

		const { content } = bodyValidation.data;

		const message = await messageService.editMessage(userId, messageId, content);

		emitMessageUpdated(message.chatId, message);

		ResponseHelper.success(res, 'Message updated successfully', message);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found or you are not the sender') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message.includes('too old to be edited')) {
				ResponseHelper.error(res, error.message, 400);
				return;
			}
		}
		next(error);
	}
}

/**
 * Delete a message by ID
 * DELETE /api/messages/:messageId
 */
export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		const deletedMessage = await messageService.deleteMessage(userId, messageId);

		emitMessageDeleted(deletedMessage.chatId, messageId);

		ResponseHelper.success(res, 'Message deleted successfully', deletedMessage);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found or you are not the sender') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Get all replies for a specific message
 * GET /api/messages/:messageId/replies
 */
export async function getMessageReplies(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		const replies = await messageService.getMessageReplies(userId, messageId);

		ResponseHelper.success(res, 'Message replies retrieved successfully', replies);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Add a reaction to a message
 * POST /api/messages/:messageId/reactions
 */
export async function addMessageReaction(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		const bodyValidation = addMessageReactionSchema.safeParse(req.body);

		if (!bodyValidation.success) {
			const errors = bodyValidation.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			ResponseHelper.validationError(res, errors);
			return;
		}

		const { emoji } = bodyValidation.data;

		await messageService.addMessageReaction(userId, messageId, emoji);

		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		if (message && user) {
			emitReactionAdded(message.chatId, messageId, {
				emoji,
				userId,
				username: user.username,
			});
		}

		ResponseHelper.success(res, 'Reaction added successfully', null, 201);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'You have already reacted with this emoji') {
				ResponseHelper.validationError(res, [{ field: 'emoji', message: error.message }]);
				return;
			}
		}
		next(error);
	}
}

/**
 * Remove a reaction from a message
 * DELETE /api/messages/:messageId/reactions/:emoji
 */
export async function deleteMessageReaction(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId, emoji } = req.params;

		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		await messageService.deleteMessageReaction(userId, messageId, emoji);

		if (message) {
			emitReactionRemoved(message.chatId, messageId, {
				emoji,
				userId,
			});
		}

		ResponseHelper.success(res, 'Reaction deleted successfully', null);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Reaction not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Mark a message as read
 * POST /api/messages/:messageId/read
 */
export async function markMessageAsRead(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		await messageService.markMessageAsRead(userId, messageId);

		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		if (message && user) {
			emitMessageRead(message.chatId, messageId, {
				userId,
				username: user.username,
				readAt: new Date(),
			});
		}

		ResponseHelper.success(res, 'Message marked as read successfully', null);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Get all users who have read a message
 * GET /api/messages/:messageId/readers
 */
export async function getMessageReaders(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		const readers = await messageService.getMessageReaders(userId, messageId);

		ResponseHelper.success(res, 'Message readers retrieved successfully', readers);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Message not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Forward a message to another chat
 * POST /api/messages/:chatId/forward
 */
export async function forwardMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;

		const bodyValidation = forwardMessageSchema.safeParse(req.body);

		if (!bodyValidation.success) {
			const errors = bodyValidation.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			ResponseHelper.validationError(res, errors);
			return;
		}

		const { messageId } = bodyValidation.data;

		const message = await messageService.forwardMessage(userId, chatId, messageId);

		emitNewMessage(chatId, message);

		ResponseHelper.success(res, 'Message forwarded successfully', message, 201);
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === 'Target chat not found or you are not a member of this chat') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'Original message not found') {
				ResponseHelper.notFound(res, error.message);
				return;
			}
			if (error.message === 'You do not have access to the original message') {
				ResponseHelper.forbidden(res, error.message);
				return;
			}
		}
		next(error);
	}
}

/**
 * Search messages in a chat
 * GET /api/messages/:chatId/search
 */
export async function searchMessages(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;
		const { query, limit, offset } = req.query;

		if (!query || typeof query !== 'string' || query.trim().length === 0) {
			ResponseHelper.validationError(res, [
				{ field: 'query', message: 'Search query is required' },
			]);
			return;
		}

		const limitNum = limit ? parseInt(limit as string, 10) : 20;
		const offsetNum = offset ? parseInt(offset as string, 10) : 0;

		if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
			ResponseHelper.validationError(res, [
				{ field: 'limit', message: 'Limit must be between 1 and 100' },
			]);
			return;
		}

		if (isNaN(offsetNum) || offsetNum < 0) {
			ResponseHelper.validationError(res, [
				{ field: 'offset', message: 'Offset must be a non-negative number' },
			]);
			return;
		}

		const result = await messageService.searchMessages(
			userId,
			chatId,
			query.trim(),
			limitNum,
			offsetNum,
		);

		ResponseHelper.success(res, 'Messages found successfully', result);
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