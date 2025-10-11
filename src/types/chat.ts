export interface User {
	id: string;
	username: string;
	email: string;
	isOnline: boolean;
	lastSeen: Date | null;
	createdAt: Date;
}

export interface LastMessage {
	id: string;
	content: string;
	senderId: string;
	senderUsername: string;
	createdAt: Date;
	wasUpdated: boolean;
}

export interface ChatMember {
	id: string;
	username: string;
	email: string;
	isOnline: boolean;
	lastSeen: Date | null;
	role: string;
	joinedAt: Date;
}

export interface ChatResponse {
	id: string;
	name: string | null;
	isGroup: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastMessage: LastMessage | null;
	unreadCount: number;
	// For 1-on-1 chats
	otherUser?: User;
	// For group chats
	members?: ChatMember[];
	memberCount?: number;
}

export interface ChatsListResponse {
	chats: ChatResponse[];
	total: number;
}

export interface ApiResponse<T = any> {
	success: boolean;
	message: string;
	data?: T;
	errors?: Array<{ field: string; message: string }>;
}
