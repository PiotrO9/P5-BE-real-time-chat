import { MessageResponse } from '../services/messageService';

// Socket Authentication Data
export interface SocketAuthData {
	userId: string;
	email: string;
}

// Client to Server Events
export interface ClientToServerEvents {
	'typing:start': (data: { chatId: string }) => void;
	'typing:stop': (data: { chatId: string }) => void;
	'chat:join': (data: { chatId: string }) => void;
}

// Server to Client Events
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
}

// Inter-server Events
export interface InterServerEvents {
	ping: () => void;
}

// Socket Data
export interface SocketData {
	userId: string;
	email: string;
}
