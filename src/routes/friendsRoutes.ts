import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
	getFriends,
	inviteFriend,
	getInvites,
	acceptInvite,
	rejectInvite,
	deleteFriend,
} from '../controllers/friendsController';

const router = Router();

/**
 * @route GET /api/friends
 * @desc Get all friends for the authenticated user
 * @access Private
 */
router.get('/', authenticateToken, getFriends);

/**
 * @route POST /api/friends/invite
 * @desc Send a friend invitation
 * @access Private
 */
router.post('/invite', authenticateToken, inviteFriend);

/**
 * @route GET /api/friends/invites
 * @desc Get all friend invitations for the authenticated user
 * @access Private
 */
router.get('/invites', authenticateToken, getInvites);

/**
 * @route PATCH /api/friends/invites/:id/accept
 * @desc Accept a friend invitation
 * @access Private
 */
router.patch('/invites/:id/accept', authenticateToken, acceptInvite);

/**
 * @route PATCH /api/friends/invites/:id/reject
 * @desc Reject a friend invitation
 * @access Private
 */
router.patch('/invites/:id/reject', authenticateToken, rejectInvite);

/**
 * @route DELETE /api/friends/:friendId
 * @desc Remove a friend
 * @access Private
 */
router.delete('/:friendId', authenticateToken, deleteFriend);

export { router as friendsRoutes };
