import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { MessageService } from '../services/messageService';
import {
	getMessagesQuerySchema,
	sendMessageSchema,
	editMessageSchema,
} from '../utils/validationSchemas';

const messageService = new MessageService();

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

		// Delete message
		await messageService.deleteMessage(userId, messageId);

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
	} catch (error) {
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
	} catch (error) {
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
	} catch (error) {
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
	} catch (error) {
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
	} catch (error) {
		next(error);
	}
}
