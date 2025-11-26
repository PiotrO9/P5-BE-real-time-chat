import { Router } from 'express';
import { seedDatabase, clearSeededData } from '../controllers/seedController';

const router = Router();

/**
 * @openapi
 * /api/seed:
 *   post:
 *     summary: Seed database with sample data
 *     description: Creates sample users, friendships, chats, and messages for testing purposes
 *     tags:
 *       - seed
 *     responses:
 *       201:
 *         description: Database seeded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Database seeded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: number
 *                       example: 8
 *                     friendships:
 *                       type: number
 *                       example: 12
 *                     chats:
 *                       type: number
 *                       example: 10
 *                     messages:
 *                       type: number
 *                       example: 45
 *                     usersList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                             example: "jan.kowalski@example.com"
 *                           username:
 *                             type: string
 *                             example: "jankowalski"
 *                     defaultPassword:
 *                       type: string
 *                       example: "password123"
 *                     note:
 *                       type: string
 *                       example: "All users have password: password123"
 *       500:
 *         description: Internal server error
 */
router.post('/', seedDatabase);

/**
 * @openapi
 * /api/seed:
 *   delete:
 *     summary: Clear seeded data from database
 *     description: Removes all seeded users, friendships, chats, and messages from the database
 *     tags:
 *       - seed
 *     responses:
 *       200:
 *         description: Seeded data cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Seeded data cleared successfully"
 *       500:
 *         description: Internal server error
 */
router.delete('/', clearSeededData);

export { router as seedRoutes };
