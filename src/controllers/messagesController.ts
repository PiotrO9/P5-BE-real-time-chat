import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { MessageService } from '../services/messageService';
import {
	getMessagesQuerySchema,
	sendMessageSchema,
	editMessageSchema,
	addMessageReactionSchema,
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

export async function getMessages(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;

		// Validate query parameters
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

		// Get messages from the service
		const result = await messageService.getMessages(userId, chatId, limit, offset);

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

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { chatId } = req.params;

		// Validate request body
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

		// Send message
		const message = await messageService.sendMessage(userId, chatId, content, replyToId);

		// Emit socket event to all chat members
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

export async function editMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Validate request body
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

		// Edit message
		const message = await messageService.editMessage(userId, messageId, content);

		// Emit socket event to all chat members
		emitMessageUpdated(message.chatId, message);

		ResponseHelper.success(res, 'Message updated successfully', message);
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

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Get message details before deletion (for chatId)
		const message = await prisma.message.findFirst({
			where: {
				id: messageId,
				senderId: userId,
				deletedAt: null,
			},
			select: {
				chatId: true,
			},
		});

		// Delete message
		await messageService.deleteMessage(userId, messageId);

		// Emit socket event to all chat members
		if (message) {
			emitMessageDeleted(message.chatId, messageId);
		}

		ResponseHelper.success(res, 'Message deleted successfully', null);
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

export async function getMessageReplies(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Get replies from the service
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

export async function addMessageReaction(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Validate request body
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

		// Add reaction
		await messageService.addMessageReaction(userId, messageId, emoji);

		// Get message and user details for socket event
		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		// Emit socket event to all chat members
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

export async function deleteMessageReaction(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId, emoji } = req.params;

		// Get message details before deletion
		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		// Delete reaction
		await messageService.deleteMessageReaction(userId, messageId, emoji);

		// Emit socket event to all chat members
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

export async function markMessageAsRead(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Mark message as read
		await messageService.markMessageAsRead(userId, messageId);

		// Get message and user details for socket event
		const message = await prisma.message.findUnique({
			where: { id: messageId },
			select: { chatId: true },
		});

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		// Emit socket event to all chat members
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

export async function getMessageReaders(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const { messageId } = req.params;

		// Get message readers
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
