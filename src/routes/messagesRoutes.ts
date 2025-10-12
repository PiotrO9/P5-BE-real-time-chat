import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
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
 * @route GET /api/messages/:chatId/messages
 * @desc Get all messages for a specific chat
 * @access Private
 */
router.get('/:chatId/messages', authenticateToken, getMessages);

/**
 * @route POST /api/messages/:chatId/messages
 * @desc Send a new message to a chat
 * @access Private
 */
router.post('/:chatId/messages', authenticateToken, sendMessage);

/**
 * @route PATCH /api/messages/:messageId
 * @desc Edit a message by ID
 * @access Private
 */
router.patch('/:messageId', authenticateToken, editMessage);

/**
 * @route DELETE /api/messages/:messageId
 * @desc Delete a message by ID
 * @access Private
 */
router.delete('/:messageId', authenticateToken, deleteMessage);

/**
 * @route GET /api/messages/:messageId/replies
 * @desc Get all replies for a specific message
 * @access Private
 */
router.get('/:messageId/replies', authenticateToken, getMessageReplies);

/**
 * @route POST /api/messages/:messageId/reactions
 * @desc Add a reaction to a message
 * @access Private
 */
router.post('/:messageId/reactions', authenticateToken, addMessageReaction);

/**
 * @route DELETE /api/messages/:messageId/reactions/:emoji
 * @desc Remove a reaction from a message
 * @access Private
 */
router.delete('/:messageId/reactions/:emoji', authenticateToken, deleteMessageReaction);

/**
 * @route POST /api/messages/:messageId/read
 * @desc Mark a message as read
 * @access Private
 */
router.post('/:messageId/read', authenticateToken, markMessageAsRead);

/**
 * @route GET /api/messages/:messageId/readers
 * @desc Get all users who have read a message
 * @access Private
 */
router.get('/:messageId/readers', authenticateToken, getMessageReaders);

export { router as messagesRoutes };
