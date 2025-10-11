import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/responseHelper';
import { ChatService } from '../services/chatService';

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

export async function createChat(req: Request, res: Response, next: NextFunction) {
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

export async function getChat(req: Request, res: Response, next: NextFunction) {
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

export async function deleteChat(req: Request, res: Response, next: NextFunction) {
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

export async function updateChat(req: Request, res: Response, next: NextFunction) {
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

export async function addChatMembers(req: Request, res: Response, next: NextFunction) {
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

export async function removeChatMembers(req: Request, res: Response, next: NextFunction) {
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
