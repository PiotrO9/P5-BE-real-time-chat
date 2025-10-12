export interface MessageResponse {
	id: string;
	chatId: string;
	senderId: string;
	senderUsername: string;
	content: string;
	wasUpdated: boolean;
	createdAt: Date;
	updatedAt: Date;
	replyTo?: {
		id: string;
		content: string;
		senderUsername: string;
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
}

export interface MessagesListResponse {
	messages: MessageResponse[];
	total: number;
	hasMore: boolean;
}
