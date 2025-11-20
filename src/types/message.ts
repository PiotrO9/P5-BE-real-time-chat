export interface MessageResponse {
	id: string;
	chatId: string;
	senderId: string;
	senderUsername: string;
	content: string;
	wasUpdated: boolean;
	editedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	replyTo?: {
		id: string;
		content: string;
		senderUsername: string;
	} | null;
	forwardedFrom?: {
		messageId: string;
		chatId: string;
		chatName: string | null;
		senderUsername: string;
		originalCreatedAt: Date;
	} | null;
	reactions?: {
		emoji: string;
		count: number;
		userIds: string[];
	}[];
	reads?: {
		userId: string;
		username: string;
		readAt: Date;
	}[];
	isPinned?: boolean;
}

export interface MessagesListResponse {
	messages: MessageResponse[];
	total: number;
	hasMore: boolean;
	lastReadMessageId?: string | null;
}
