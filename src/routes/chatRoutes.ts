import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
	getChats,
	createChat,
	getChat,
	deleteChat,
	updateChat,
	addChatMembers,
	removeChatMembers,
	updateChatMembersRole,
} from '../controllers/chatController';

const router = Router();

/**
 * @openapi
 * /api/chats:
 *   get:
 *     summary: Get all chats for the authenticated user
 *     description: Returns a list of all chats for the authenticated user
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of chats
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
 *                   example: Chats retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     chats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                             nullable: true
 *                           isGroup:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           lastMessage:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               content:
 *                                 type: string
 *                               senderId:
 *                                 type: string
 *                                 format: uuid
 *                               senderUsername:
 *                                 type: string
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                               wasUpdated:
 *                                 type: boolean
 *                           unreadCount:
 *                             type: number
 *                           otherUser:
 *                             type: object
 *                             nullable: true
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
 *                               lastSeen:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                           members:
 *                             type: array
 *                             nullable: true
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   format: uuid
 *                                 username:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                                 isOnline:
 *                                   type: boolean
 *                                 lastSeen:
 *                                   type: string
 *                                   format: date-time
 *                                   nullable: true
 *                                 role:
 *                                   type: string
 *                                 joinedAt:
 *                                   type: string
 *                                   format: date-time
 *                           memberCount:
 *                             type: number
 *                             nullable: true
 *                     total:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.get('/', authenticateToken, getChats);

/**
 * @openapi
 * /api/chats:
 *   post:
 *     summary: Create a new chat
 *     description: Create a new 1-on-1 chat or group chat
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID for 1-on-1 chat
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Chat name for group chat
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of user IDs for group chat (minimum 2)
 *             oneOf:
 *               - required: [participantId]
 *               - required: [name, participantIds]
 *           examples:
 *             oneOnOne:
 *               value:
 *                 participantId: "123e4567-e89b-12d3-a456-426614174000"
 *             group:
 *               value:
 *                 name: "My Group Chat"
 *                 participantIds: ["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174001"]
 *     responses:
 *       201:
 *         description: Chat created successfully
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
 *                   example: Chat created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     isGroup:
 *                       type: boolean
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, createChat);

/**
 * @openapi
 * /api/chats/{id}:
 *   get:
 *     summary: Get a specific chat by ID
 *     description: Returns detailed information about a specific chat
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat details
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
 *                   example: Chat retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     isGroup:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticateToken, getChat);

/**
 * @openapi
 * /api/chats/{id}:
 *   delete:
 *     summary: Delete a chat by ID
 *     description: Delete a chat. Only chat owner can delete.
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat deleted successfully
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
 *                   example: Chat deleted successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateToken, deleteChat);

/**
 * @openapi
 * /api/chats/{id}:
 *   patch:
 *     summary: Update a chat by ID
 *     description: Update chat name (only for group chats)
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Updated Chat Name"
 *     responses:
 *       200:
 *         description: Chat updated successfully
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
 *                   example: Chat updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', authenticateToken, updateChat);

/**
 * @openapi
 * /api/chats/{id}/members:
 *   post:
 *     summary: Add members to a chat
 *     description: Add one or more members to a group chat
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174001"]
 *     responses:
 *       200:
 *         description: Members added successfully
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
 *                   example: Members added successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:id/members', authenticateToken, addChatMembers);

/**
 * @openapi
 * /api/chats/{id}/members:
 *   delete:
 *     summary: Remove members from a chat
 *     description: Remove one or more members from a group chat
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["123e4567-e89b-12d3-a456-426614174000"]
 *     responses:
 *       200:
 *         description: Members removed successfully
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
 *                   example: Members removed successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/members', authenticateToken, removeChatMembers);

/**
 * @openapi
 * /api/chats/{id}/members/{userId}/role:
 *   patch:
 *     summary: Update a chat member's role
 *     description: Update the role of a chat member (USER, MODERATOR, OWNER)
 *     tags:
 *       - chats
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, MODERATOR, OWNER]
 *                 example: "MODERATOR"
 *     responses:
 *       200:
 *         description: Role updated successfully
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
 *                   example: Role updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Chat or member not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/members/:userId/role', authenticateToken, updateChatMembersRole);

export { router as chatRoutes };
