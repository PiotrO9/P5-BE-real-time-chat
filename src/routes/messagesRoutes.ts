import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendMessageRateLimiter } from '../middleware/rateLimiter';
import {
	getMessages,
	sendMessage,
	editMessage,
	deleteMessage,
	getMessageReplies,
	addMessageReaction,
	deleteMessageReaction,
	markMessageAsRead,
	getMessageReaders,
} from '../controllers/messagesController';

const router = Router();

/**
 * @openapi
 * /api/messages/{chatId}/messages:
 *   get:
 *     summary: Get all messages for a specific chat
 *     description: Get paginated messages for a specific chat with optional limit and offset
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of messages to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of messages to skip
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                   example: Messages retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           chatId:
 *                             type: string
 *                             format: uuid
 *                           senderId:
 *                             type: string
 *                             format: uuid
 *                           senderUsername:
 *                             type: string
 *                           content:
 *                             type: string
 *                           wasUpdated:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           replyTo:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               content:
 *                                 type: string
 *                               senderUsername:
 *                                 type: string
 *                           reactions:
 *                             type: array
 *                             nullable: true
 *                             items:
 *                               type: object
 *                               properties:
 *                                 emoji:
 *                                   type: string
 *                                 count:
 *                                   type: number
 *                                 userIds:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                     format: uuid
 *                           reads:
 *                             type: array
 *                             nullable: true
 *                             items:
 *                               type: object
 *                               properties:
 *                                 userId:
 *                                   type: string
 *                                   format: uuid
 *                                 username:
 *                                   type: string
 *                                 readAt:
 *                                   type: string
 *                                   format: date-time
 *                     total:
 *                       type: number
 *                     hasMore:
 *                       type: boolean
 *       404:
 *         description: Chat not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:chatId/messages', authenticateToken, getMessages);

/**
 * @openapi
 * /api/messages/{chatId}/messages:
 *   post:
 *     summary: Send a new message to a chat
 *     description: Send a message to a chat, optionally as a reply to another message
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: "Hello, this is a message!"
 *               replyToId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: ID of the message this is replying to (optional)
 *     responses:
 *       201:
 *         description: Message sent successfully
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
 *                   example: Message sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     chatId:
 *                       type: string
 *                       format: uuid
 *                     senderId:
 *                       type: string
 *                       format: uuid
 *                     content:
 *                       type: string
 *                     wasUpdated:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Chat not found
 *       403:
 *         description: Forbidden - user is not a member of the chat
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too Many Requests - rate limit exceeded (30 messages per minute per IP)
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
 *                   example: Zbyt wiele wiadomości. Spróbuj ponownie za chwilę.
 *                 retryAfter:
 *                   type: number
 *                   example: 45
 *       500:
 *         description: Internal server error
 */
router.post('/:chatId/messages', authenticateToken, sendMessageRateLimiter, sendMessage);

/**
 * @openapi
 * /api/messages/{messageId}:
 *   patch:
 *     summary: Edit a message by ID
 *     description: Edit the content of a message (only the sender can edit)
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: "Edited message content"
 *     responses:
 *       200:
 *         description: Message updated successfully
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
 *                   example: Message updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     content:
 *                       type: string
 *                     wasUpdated:
 *                       type: boolean
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Forbidden - can only edit own messages
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/:messageId', authenticateToken, editMessage);

/**
 * @openapi
 * /api/messages/{messageId}:
 *   delete:
 *     summary: Delete a message by ID
 *     description: Delete a message (only the sender can delete)
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
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
 *                   example: Message deleted successfully
 *       403:
 *         description: Forbidden - can only delete own messages
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:messageId', authenticateToken, deleteMessage);

/**
 * @openapi
 * /api/messages/{messageId}/replies:
 *   get:
 *     summary: Get all replies for a specific message
 *     description: Get all messages that are replies to the specified message
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Replies retrieved successfully
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
 *                   example: Replies retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       content:
 *                         type: string
 *                       senderId:
 *                         type: string
 *                         format: uuid
 *                       senderUsername:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:messageId/replies', authenticateToken, getMessageReplies);

/**
 * @openapi
 * /api/messages/{messageId}/reactions:
 *   post:
 *     summary: Add a reaction to a message
 *     description: Add an emoji reaction to a message
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction added successfully
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
 *                   example: Reaction added successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     emoji:
 *                       type: string
 *                     count:
 *                       type: number
 *                     userIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *       400:
 *         description: Bad request - validation error or reaction already exists
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:messageId/reactions', authenticateToken, addMessageReaction);

/**
 * @openapi
 * /api/messages/{messageId}/reactions/{emoji}:
 *   delete:
 *     summary: Remove a reaction from a message
 *     description: Remove an emoji reaction from a message
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *       - in: path
 *         name: emoji
 *         required: true
 *         schema:
 *           type: string
 *         description: Emoji to remove
 *     responses:
 *       200:
 *         description: Reaction removed successfully
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
 *                   example: Reaction removed successfully
 *       404:
 *         description: Message or reaction not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:messageId/reactions/:emoji', authenticateToken, deleteMessageReaction);

/**
 * @openapi
 * /api/messages/{messageId}/read:
 *   post:
 *     summary: Mark a message as read
 *     description: Mark a message as read by the authenticated user
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message marked as read successfully
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
 *                   example: Message marked as read successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/:messageId/read', authenticateToken, markMessageAsRead);

/**
 * @openapi
 * /api/messages/{messageId}/readers:
 *   get:
 *     summary: Get all users who have read a message
 *     description: Get a list of all users who have marked the message as read
 *     tags:
 *       - messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Readers retrieved successfully
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
 *                   example: Readers retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       readAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/:messageId/readers', authenticateToken, getMessageReaders);

export { router as messagesRoutes };
