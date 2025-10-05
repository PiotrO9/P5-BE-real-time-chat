import { Router } from 'express';
import {
	getUserProfile,
	getAllUsers,
	updateUserProfile,
	deleteUser,
} from '../controllers/userController';
import { authenticateToken, authorizeUserModification } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getAllUsers);
router.get('/:id', authenticateToken, getUserProfile);
router.put('/:id', authenticateToken, authorizeUserModification, updateUserProfile);
router.delete('/:id', authenticateToken, authorizeUserModification, deleteUser);

export { router as userRoutes };
