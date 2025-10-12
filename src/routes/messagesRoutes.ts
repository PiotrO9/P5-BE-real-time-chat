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

router.get('/:chatId/messages', authenticateToken, getMessages);
router.post('/:chatId/messages', authenticateToken, sendMessage);
router.patch('/:messageId', authenticateToken, editMessage);
router.delete('/:messageId', authenticateToken, deleteMessage);
router.get('/:messageId/replies', authenticateToken, getMessageReplies);

router.post('/:messageId/reactions', authenticateToken, addMessageReaction);
router.delete('/:messageId/reactions/:emoji', authenticateToken, deleteMessageReaction);

router.post('/:messageId/read', authenticateToken, markMessageAsRead);
router.get('/:messageId/readers', authenticateToken, getMessageReaders);

export { router as messagesRoutes };
