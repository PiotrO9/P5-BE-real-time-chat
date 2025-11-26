import { MessageResponse } from '../services/messageService';
import { FriendInviteResponse, FriendshipResponse, User } from './friends';

export interface SocketAuthData {
	userId: string;
	email: string;
}

export interface ClientToServerEvents {
	'typing:start': (data: { chatId: string }) => void;
	'typing:stop': (data: { chatId: string }) => void;
	'chat:join': (data: { chatId: string }) => void;
}

export interface ServerToClientEvents {
	'message:new': (data: { chatId: string; message: MessageResponse }) => void;
	'message:updated': (data: { chatId: string; message: MessageResponse }) => void;
	'message:deleted': (data: { chatId: string; messageId: string }) => void;
	'reaction:added': (data: {
		chatId: string;
		messageId: string;
		reaction: { emoji: string; userId: string; username: string };
	}) => void;
	'reaction:removed': (data: {
		chatId: string;
		messageId: string;
		reaction: { emoji: string; userId: string };
	}) => void;
	'message:read': (data: {
		chatId: string;
		messageId: string;
		reader: { userId: string; username: string; readAt: Date };
	}) => void;
	'typing:start': (data: { chatId: string; userId: string; username: string }) => void;
	'typing:stop': (data: { chatId: string; userId: string }) => void;
	'user:status': (data: { userId: string; isOnline: boolean; lastSeen?: Date }) => void;
	'chat:created': (data: { chat: any }) => void;
	'chat:updated': (data: { chatId: string; updates: any }) => void;
	'member:added': (data: { chatId: string; member: any }) => void;
	'member:removed': (data: { chatId: string; userId: string }) => void;
	'message:pinned': (data: {
		chatId: string;
		pinnedMessage: {
			id: string;
			message: {
				id: string;
				content: string;
				senderId: string;
				senderUsername: string;
				createdAt: Date;
			};
			pinnedBy: {
				id: string;
				username: string;
			};
			pinnedAt: Date;
		};
	}) => void;
	'message:unpinned': (data: { chatId: string; messageId: string }) => void;
	'friend:invite:received': (data: { invite: FriendInviteResponse }) => void;
	'friend:invite:accepted': (data: { friendship: FriendshipResponse }) => void;
	'friend:invite:rejected': (data: { invite: FriendInviteResponse }) => void;
	'friend:removed': (data: { friendId: string; friend: User }) => void;
}

export interface InterServerEvents {
	ping: () => void;
}

export interface SocketData {
	userId: string;
	email: string;
}
