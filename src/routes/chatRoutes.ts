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

router.get('/', authenticateToken, getChats);
router.post('/', authenticateToken, createChat);
router.get('/:id', authenticateToken, getChat);
router.delete('/:id', authenticateToken, deleteChat);
router.patch('/:id', authenticateToken, updateChat);
router.post('/:id/members', authenticateToken, addChatMembers);
router.delete('/:id/members', authenticateToken, removeChatMembers);
router.patch('/:id/members/:userId/role', authenticateToken, updateChatMembersRole);

export { router as chatRoutes };
