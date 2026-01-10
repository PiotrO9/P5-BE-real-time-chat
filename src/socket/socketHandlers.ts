import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
} from '../types/socket';
import { socketAuthMiddleware } from './socketAuth';
import { emitTypingStart, emitTypingStop, emitUserStatusChange } from './socketEmitters';
import { UserService } from '../services/userService';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type AuthSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const prisma = new PrismaClient();
const userService = new UserService();

/**
 * Initialize socket handlers
 */
export function initializeSocketHandlers(io: IoServer) {
	// Apply authentication middleware
	io.use(socketAuthMiddleware);

	// Handle connections
	io.on('connection', async (socket: AuthSocket) => {
		const userId = socket.data.userId;
		const email = socket.data.email;

		console.log(`✅ User connected: ${email} (${userId})`);

		// Store username for handlers - will be set if user exists
		let username: string | null = null;

		try {
			// Set user status to online
			await userService.setUserOnline(userId);

			// Get user details for broadcasting
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					isOnline: true,
					lastSeen: true,
				},
			});

			if (user) {
				username = user.username;
				// Broadcast online status to friends/contacts
				await emitUserStatusChange(userId, true, user.lastSeen || undefined);
			}

			// Join user's personal room
			socket.join(`user:${userId}`);

			// Get all chats user is part of and join their rooms
			const userChats = await prisma.chatUser.findMany({
				where: {
					userId,
					deletedAt: null,
				},
				select: {
					chatId: true,
				},
			});

			// Join all chat rooms
			userChats.forEach(chatUser => {
				socket.join(`chat:${chatUser.chatId}`);
			});

			console.log(`📨 User ${email} joined ${userChats.length} chat room(s) and personal room`);

			// Handle typing start
			socket.on('typing:start', async data => {
				const { chatId } = data;

				// Verify user is member of this chat
				const isMember = await prisma.chatUser.findFirst({
					where: {
						userId,
						chatId,
						deletedAt: null,
					},
				});

				if (isMember && username) {
					emitTypingStart(chatId, userId, username);
				}
			});

			// Handle typing stop
			socket.on('typing:stop', async data => {
				const { chatId } = data;

				// Verify user is member of this chat
				const isMember = await prisma.chatUser.findFirst({
					where: {
						userId,
						chatId,
						deletedAt: null,
					},
				});

				if (isMember) {
					emitTypingStop(chatId, userId);
				}
			});

			// Handle manual chat join
			socket.on('chat:join', async data => {
				const { chatId } = data;

				// Verify user is member of this chat
				const isMember = await prisma.chatUser.findFirst({
					where: {
						userId,
						chatId,
						deletedAt: null,
					},
				});

				if (isMember) {
					socket.join(`chat:${chatId}`);
					console.log(`📨 User ${email} manually joined chat room: ${chatId}`);
				}
			});

			// Handle disconnect
			socket.on('disconnect', async () => {
				console.log(`❌ User disconnected: ${email} (${userId})`);

				try {
					// Set user status to offline
					await userService.setUserOffline(userId);

					// Get updated user details
					const updatedUser = await prisma.user.findUnique({
						where: { id: userId },
						select: {
							lastSeen: true,
						},
					});

					// Broadcast offline status
					if (updatedUser) {
						await emitUserStatusChange(userId, false, updatedUser.lastSeen || undefined);
					}
				} catch (error) {
					console.error(`Error handling disconnect for user ${userId}:`, error);
				}
			});
		} catch (error) {
			console.error(`Error handling connection for user ${userId}:`, error);
			socket.disconnect();
		}
	});

	console.log('🔌 Socket.io handlers initialized');
}
