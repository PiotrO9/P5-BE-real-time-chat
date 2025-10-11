import { Request, Response, NextFunction } from 'express';
import { inviteFriendSchema } from '../utils/validationSchemas';
import { FriendsService } from '../services/friendsService';
import { ResponseHelper } from '../utils/responseHelper';

const friendsService = new FriendsService();

/**
 * Get all friends for current user
 * GET /api/friends
 */
export async function getFriends(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const friends = await friendsService.getFriends(userId);

		ResponseHelper.success(res, 'Friends retrieved successfully', {
			friends,
			count: friends.length,
		});
	} catch (error) {
		next(error);
	}
}

/**
 * Send friend invitation by username
 * POST /api/friends/invite
 */
export async function inviteFriend(req: Request, res: Response, next: NextFunction) {
	try {
		const senderId = req.user?.userId;

		if (!senderId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		// Validate input data
		const validationResult = inviteFriendSchema.safeParse(req.body);
		if (!validationResult.success) {
			const errors = validationResult.error.issues.map((err: any) => ({
				field: err.path.join('.'),
				message: err.message,
			}));
			ResponseHelper.validationError(res, errors);
			return;
		}

		const { username } = validationResult.data;

		const invite = await friendsService.inviteFriend(senderId, username);

		ResponseHelper.success(
			res,
			`Invitation sent to ${username}`,
			{
				invite,
			},
			201,
		);
	} catch (error) {
		if (error instanceof Error) {
			ResponseHelper.error(res, error.message, 400);
			return;
		}
		next(error);
	}
}

/**
 * Get all pending friend invitations
 * GET /api/friends/invites
 */
export async function getInvites(req: Request, res: Response, next: NextFunction) {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		const invites = await friendsService.getInvites(userId);

		ResponseHelper.success(res, 'Invitations retrieved successfully', invites);
	} catch (error) {
		next(error);
	}
}

/**
 * Accept friend invitation
 * POST /api/friends/invites/:id/accept
 */
export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
	try {
		const currentUserId = req.user?.userId;
		const inviteId = req.params.id;

		if (!currentUserId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		if (!inviteId) {
			ResponseHelper.error(res, 'Invitation ID is missing', 400);
			return;
		}

		const friendship = await friendsService.acceptInvite(inviteId, currentUserId);

		ResponseHelper.success(res, `Accepted invitation from ${friendship.requester.username}`, {
			friendship,
		});
	} catch (error) {
		if (error instanceof Error) {
			const statusCode = error.message.includes('not found')
				? 404
				: error.message.includes('permission')
				? 403
				: 400;
			ResponseHelper.error(res, error.message, statusCode);
			return;
		}
		next(error);
	}
}

/**
 * Reject friend invitation
 * POST /api/friends/invites/:id/reject
 */
export async function rejectInvite(req: Request, res: Response, next: NextFunction) {
	try {
		const currentUserId = req.user?.userId;
		const inviteId = req.params.id;

		if (!currentUserId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		if (!inviteId) {
			ResponseHelper.error(res, 'Invitation ID is missing', 400);
			return;
		}

		const invite = await friendsService.rejectInvite(inviteId, currentUserId);

		ResponseHelper.success(res, `Rejected invitation from ${invite.sender?.username}`, {
			invite,
		});
	} catch (error) {
		if (error instanceof Error) {
			const statusCode = error.message.includes('not found')
				? 404
				: error.message.includes('permission')
				? 403
				: 400;
			ResponseHelper.error(res, error.message, statusCode);
			return;
		}
		next(error);
	}
}

/**
 * Remove friend from friend list
 * DELETE /api/friends/:friendId
 */
export async function deleteFriend(req: Request, res: Response, next: NextFunction) {
	try {
		const currentUserId = req.user?.userId;
		const friendId = req.params.friendId;

		if (!currentUserId) {
			ResponseHelper.unauthorized(res);
			return;
		}

		if (!friendId) {
			ResponseHelper.error(res, 'Friend ID is missing', 400);
			return;
		}

		const deletedFriend = await friendsService.deleteFriend(friendId, currentUserId);

		ResponseHelper.success(res, `Removed ${deletedFriend.username} from friend list`, {
			deletedFriend,
			deletedAt: new Date(),
		});
	} catch (error) {
		if (error instanceof Error) {
			const statusCode = error.message.includes('not found') ? 404 : 400;
			ResponseHelper.error(res, error.message, statusCode);
			return;
		}
		next(error);
	}
}
