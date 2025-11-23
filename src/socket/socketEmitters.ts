import { Server } from 'socket.io';
import { MessageResponse } from '../types/message';
import { FriendInviteResponse, FriendshipResponse, User } from '../types/friends';
import {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
} from '../types/socket';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: IoServer | null = null;

/**
 * Initialize socket emitters with io instance
 */
export function initializeSocketEmitters(ioInstance: IoServer) {
	io = ioInstance;
}

/**
 * Get io instance
 */
function getIo(): IoServer {
	if (!io) {
		throw new Error('Socket.io not initialized. Call initializeSocketEmitters first.');
	}
	return io;
}

/**
 * Emit new message to chat room
 */
export function emitNewMessage(chatId: string, message: MessageResponse) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:new', { chatId, message });
}

/**
 * Emit message updated to chat room
 */
export function emitMessageUpdated(chatId: string, message: MessageResponse) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:updated', { chatId, message });
}

/**
 * Emit message deleted to chat room
 */
export function emitMessageDeleted(chatId: string, messageId: string) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:deleted', { chatId, messageId });
}

/**
 * Emit reaction added to chat room
 */
export function emitReactionAdded(
	chatId: string,
	messageId: string,
	reaction: { emoji: string; userId: string; username: string },
) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('reaction:added', { chatId, messageId, reaction });
}

/**
 * Emit reaction removed to chat room
 */
export function emitReactionRemoved(
	chatId: string,
	messageId: string,
	reaction: { emoji: string; userId: string },
) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('reaction:removed', { chatId, messageId, reaction });
}

/**
 * Emit message read to chat room
 */
export function emitMessageRead(
	chatId: string,
	messageId: string,
	reader: { userId: string; username: string; readAt: Date },
) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:read', { chatId, messageId, reader });
}

/**
 * Emit user status change to all relevant users
 */
export function emitUserStatusChange(userId: string, isOnline: boolean, lastSeen?: Date) {
	const io = getIo();
	io.to(`user:${userId}`).emit('user:status', { userId, isOnline, lastSeen });
}

/**
 * Emit new chat created to all participants
 */
export function emitChatCreated(chat: any, participantIds: string[]) {
	const io = getIo();
	participantIds.forEach(userId => {
		io.to(`user:${userId}`).emit('chat:created', { chat });
	});
}

/**
 * Emit chat updated to chat room
 */
export function emitChatUpdated(chatId: string, updates: any) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('chat:updated', { chatId, updates });
}

/**
 * Emit member added to chat room
 */
export function emitMemberAdded(chatId: string, member: any) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('member:added', { chatId, member });
	// Also emit to the new member's personal room
	io.to(`user:${member.userId}`).emit('member:added', { chatId, member });
}

/**
 * Emit member removed to chat room
 */
export function emitMemberRemoved(chatId: string, userId: string) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('member:removed', { chatId, userId });
}

/**
 * Emit typing start to chat room
 */
export function emitTypingStart(chatId: string, userId: string, username: string) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('typing:start', { chatId, userId, username });
}

/**
 * Emit typing stop to chat room
 */
export function emitTypingStop(chatId: string, userId: string) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
}

/**
 * Emit message pinned to chat room
 */
export function emitMessagePinned(chatId: string, pinnedMessage: any) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:pinned', { chatId, pinnedMessage });
}

/**
 * Emit message unpinned to chat room
 */
export function emitMessageUnpinned(chatId: string, messageId: string) {
	const io = getIo();
	io.to(`chat:${chatId}`).emit('message:unpinned', { chatId, messageId });
}

/**
 * Emit friend invitation received to receiver's personal room
 */
export function emitFriendInviteReceived(receiverId: string, invite: FriendInviteResponse) {
	const io = getIo();
	io.to(`user:${receiverId}`).emit('friend:invite:received', { invite });
}

/**
 * Emit friend invitation accepted to both users' personal rooms
 */
export function emitFriendInviteAccepted(
	requesterId: string,
	addresseeId: string,
	friendship: FriendshipResponse,
) {
	const io = getIo();
	io.to(`user:${requesterId}`).emit('friend:invite:accepted', { friendship });
	io.to(`user:${addresseeId}`).emit('friend:invite:accepted', { friendship });
}

/**
 * Emit friend invitation rejected to sender's personal room
 */
export function emitFriendInviteRejected(senderId: string, invite: FriendInviteResponse) {
	const io = getIo();
	io.to(`user:${senderId}`).emit('friend:invite:rejected', { invite });
}

/**
 * Emit friend removed to both users' personal rooms
 */
export function emitFriendRemoved(userId1: string, userId2: string, removedFriend: User) {
	const io = getIo();
	io.to(`user:${userId1}`).emit('friend:removed', { friendId: userId2, friend: removedFriend });
	io.to(`user:${userId2}`).emit('friend:removed', { friendId: userId1, friend: removedFriend });
}