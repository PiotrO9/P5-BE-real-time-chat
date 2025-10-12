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
 * @route GET /api/chats
 * @desc Get all chats for the authenticated user
 * @access Private
 */
router.get('/', authenticateToken, getChats);

/**
 * @route POST /api/chats
 * @desc Create a new chat
 * @access Private
 */
router.post('/', authenticateToken, createChat);

/**
 * @route GET /api/chats/:id
 * @desc Get a specific chat by ID
 * @access Private
 */
router.get('/:id', authenticateToken, getChat);

/**
 * @route DELETE /api/chats/:id
 * @desc Delete a chat by ID
 * @access Private
 */
router.delete('/:id', authenticateToken, deleteChat);

/**
 * @route PATCH /api/chats/:id
 * @desc Update a chat by ID
 * @access Private
 */
router.patch('/:id', authenticateToken, updateChat);

/**
 * @route POST /api/chats/:id/members
 * @desc Add members to a chat
 * @access Private
 */
router.post('/:id/members', authenticateToken, addChatMembers);

/**
 * @route DELETE /api/chats/:id/members
 * @desc Remove members from a chat
 * @access Private
 */
router.delete('/:id/members', authenticateToken, removeChatMembers);

/**
 * @route PATCH /api/chats/:id/members/:userId/role
 * @desc Update a chat member's role
 * @access Private
 */
router.patch('/:id/members/:userId/role', authenticateToken, updateChatMembersRole);

export { router as chatRoutes };
