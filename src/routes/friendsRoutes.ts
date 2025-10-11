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

router.get('/', authenticateToken, getFriends);
router.post('/invite', authenticateToken, inviteFriend);
router.get('/invites', authenticateToken, getInvites);
router.patch('/invites/:id/accept', authenticateToken, acceptInvite);
router.patch('/invites/:id/reject', authenticateToken, rejectInvite);
router.delete('/:friendId', authenticateToken, deleteFriend);

export { router as friendsRoutes };
