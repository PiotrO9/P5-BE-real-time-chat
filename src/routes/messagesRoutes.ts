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
} from '../controllers/messagesController';

const router = Router();

router.get('/:chatId/messages', authenticateToken, getMessages);
router.post('/:chatId/messages', authenticateToken, sendMessage);
router.patch('/:id', authenticateToken, editMessage);
router.delete('/:id', authenticateToken, deleteMessage);
router.get('/:id/replies', authenticateToken, getMessageReplies);

router.post('/:id/reactions', authenticateToken, addMessageReaction);
router.delete('/:id/reactions', authenticateToken, deleteMessageReaction);

router.post('/:id/read', authenticateToken, markMessageAsRead);
router.get('/:id/readers', authenticateToken, getMessageReaders);

export { router as messagesRoutes };
