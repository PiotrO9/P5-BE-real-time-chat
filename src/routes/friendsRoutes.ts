import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
	getFriends,
	inviteFriend,
	getInvites,
	acceptInvite,
	rejectInvite,
	deleteFriend,
	searchFriends,
} from '../controllers/friendsController';

const router = Router();

/**
 * @openapi
 * /api/friends:
 *   get:
 *     summary: Get all friends for the authenticated user
 *     description: Returns a list of all friends for the authenticated user
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Friends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Friends retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       isOnline:
 *                         type: boolean
 *                       lastSeen:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       friendshipCreatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getFriends);

/**
 * @openapi
 * /api/friends/invite:
 *   post:
 *     summary: Send a friend invitation
 *     description: Send a friend invitation to another user by username
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 1
 *                 example: "friendusername"
 *     responses:
 *       201:
 *         description: Friend invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Friend invitation sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACCEPTED, REJECTED]
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: User not found
 *       409:
 *         description: Conflict - invitation already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/invite', authenticateToken, inviteFriend);

/**
 * @openapi
 * /api/friends/invites:
 *   get:
 *     summary: Get all friend invitations
 *     description: Get all sent and received friend invitations for the authenticated user
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Invitations retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     sentInvites:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           status:
 *                             type: string
 *                             enum: [PENDING, ACCEPTED, REJECTED]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           receiver:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               isOnline:
 *                                 type: boolean
 *                     receivedInvites:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           status:
 *                             type: string
 *                             enum: [PENDING, ACCEPTED, REJECTED]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           sender:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               isOnline:
 *                                 type: boolean
 *                     totalSent:
 *                       type: number
 *                     totalReceived:
 *                       type: number
 *                     totalPending:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/invites', authenticateToken, getInvites);

/**
 * @openapi
 * /api/friends/invites/{id}/accept:
 *   patch:
 *     summary: Accept a friend invitation
 *     description: Accept a friend invitation by invitation ID
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Friend invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Friend invitation accepted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     requester:
 *                       type: object
 *                     addressee:
 *                       type: object
 *       404:
 *         description: Invitation not found
 *       403:
 *         description: Forbidden - cannot accept own invitation
 *       400:
 *         description: Bad request - invitation already processed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/invites/:id/accept', authenticateToken, acceptInvite);

/**
 * @openapi
 * /api/friends/invites/{id}/reject:
 *   patch:
 *     summary: Reject a friend invitation
 *     description: Reject a friend invitation by invitation ID
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Friend invitation rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Friend invitation rejected successfully
 *       404:
 *         description: Invitation not found
 *       403:
 *         description: Forbidden - cannot reject own invitation
 *       400:
 *         description: Bad request - invitation already processed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/invites/:id/reject', authenticateToken, rejectInvite);

/**
 * @openapi
 * /api/friends/{friendId}:
 *   delete:
 *     summary: Remove a friend
 *     description: Remove a friend from the friends list
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Friend user ID
 *     responses:
 *       200:
 *         description: Friend removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Friend removed successfully
 *       404:
 *         description: Friendship not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:friendId', authenticateToken, deleteFriend);

/**
 * @openapi
 * /api/friends/search:
 *   get:
 *     summary: Search friends by username or email
 *     description: Search for friends by username or email (case-insensitive)
 *     tags:
 *       - friends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query (searches in username and email)
 *     responses:
 *       200:
 *         description: Friends found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     friends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                           isOnline:
 *                             type: boolean
 *                           lastSeen:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           friendshipCreatedAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: number
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/search', authenticateToken, searchFriends);

export { router as friendsRoutes };
