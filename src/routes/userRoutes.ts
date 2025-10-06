import { Router } from 'express';
import {
	getUserProfile,
	getAllUsers,
	updateUserProfile,
	deleteUser,
	getUserStatus,
} from '../controllers/userController';
import { authenticateToken, authorizeUserModification } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/users
 * @desc Get all users with pagination
 * @access Private
 */
router.get('/', authenticateToken, getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get a user's profile by ID
 * @access Private
 */
router.get('/:id', authenticateToken, getUserProfile);

/**
 * @route GET /api/users/:id/status
 * @desc Get a user's online status by ID
 * @access Private
 */
router.get('/:id/status', authenticateToken, getUserStatus);

// TODO
router.patch('/:id/password', authenticateToken);

/**
 * @route PUT /api/users/:id
 * @desc Update a user's profile by ID
 * @access Private (only the user themselves can update)
 */
router.put('/:id', authenticateToken, authorizeUserModification, updateUserProfile);

/**
 * @route DELETE /api/users/:id
 * @desc Delete a user by ID
 * @access Private (only the user themselves or an admin can delete)
 */
router.delete('/:id', authenticateToken, authorizeUserModification, deleteUser);

export { router as userRoutes };
