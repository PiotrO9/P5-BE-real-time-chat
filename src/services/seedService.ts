import bcrypt from 'bcrypt';
import { PrismaClient, ChatRole, InviteStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class SeedService {
	/**
	 * Seed database with users, friendships, and chats
	 */
	async seedDatabase(): Promise<{
		users: Array<{ email: string; username: string }>;
		defaultPassword: string;
		statistics: {
			users: number;
			friendships: number;
			friendInvites: number;
			chats: number;
			messages: number;
			messageReactions: number;
			messageReads: number;
			pinnedMessages: number;
		};
	}> {
		const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD as string;

		await this.clearDatabase();

		const users = await this.createUsers(DEFAULT_PASSWORD);

		const friendships = await this.createFriendships(users);

		const friendInvites = await this.createFriendInvites(users);

		const chats = await this.createChats(users);

		const messages = await this.createMessages(chats, users);

		const messageReactions = await this.createMessageReactions(messages, users);

		const messageReads = await this.createMessageReads(messages, chats, users);

		const pinnedMessages = await this.createPinnedMessages(chats, messages, users);

		await this.updateChatUserLastRead(chats, messages);

		const userList = users.map(user => ({
			email: user.email,
			username: user.username,
		}));

		return {
			users: userList,
			defaultPassword: DEFAULT_PASSWORD,
			statistics: {
				users: users.length,
				friendships: friendships.length,
				friendInvites: friendInvites.length,
				chats: chats.length,
				messages: messages.length,
				messageReactions: messageReactions.length,
				messageReads: messageReads.length,
				pinnedMessages: pinnedMessages.length,
			},
		};
	}

	/**
	 * Clear all seeded data
	 */
	private async clearDatabase(): Promise<void> {
		await prisma.$transaction([
			prisma.messageReaction.deleteMany(),
			prisma.messageRead.deleteMany(),
			prisma.pinnedMessage.deleteMany(),
			prisma.message.deleteMany(),
			prisma.chatUser.deleteMany(),
			prisma.chat.deleteMany(),
			prisma.friendship.deleteMany(),
			prisma.friendInvite.deleteMany(),
			prisma.refreshToken.deleteMany(),
			prisma.user.deleteMany(),
		]);
	}

	/**
	 * Create sample users
	 */
	private async createUsers(plainPassword: string) {
		const saltRounds = 12;
		const defaultPassword = await bcrypt.hash(plainPassword, saltRounds);

		const predefinedUsers = [
			{ firstName: 'admin', lastName: 'user', email: 'admin@example.com', username: 'admin' },
			{ firstName: 'test', lastName: 'user1', email: 'test1@example.com', username: 'testuser1' },
			{ firstName: 'test', lastName: 'user2', email: 'test2@example.com', username: 'testuser2' },
			{ firstName: 'demo', lastName: 'user', email: 'demo@example.com', username: 'demo' },
		];

		const firstNames = [
			'John',
			'Emma',
			'Michael',
			'Sarah',
			'David',
			'Emily',
			'James',
			'Olivia',
			'Robert',
			'Jessica',
			'William',
			'Ashley',
			'Richard',
			'Jennifer',
			'Joseph',
			'Michelle',
		];

		const lastNames = [
			'Smith',
			'Johnson',
			'Williams',
			'Brown',
			'Jones',
			'Garcia',
			'Miller',
			'Davis',
			'Rodriguez',
			'Martinez',
			'Hernandez',
			'Lopez',
			'Wilson',
			'Anderson',
			'Thomas',
			'Taylor',
		];

		const userData = [];

		for (const predefined of predefinedUsers) {
			userData.push({
				email: predefined.email,
				username: predefined.username,
				password: defaultPassword,
				isOnline: false,
				lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
			});
		}

		const additionalUsersCount = 20 - predefinedUsers.length;
		for (let i = 0; i < additionalUsersCount; i++) {
			const firstName = firstNames[i % firstNames.length];
			const lastName = lastNames[i % lastNames.length];
			const email = `${firstName.toLowerCase()}${i}.${lastName.toLowerCase()}@example.com`;
			const username = `${firstName.toLowerCase()}${i}${lastName.toLowerCase()}`;

			userData.push({
				email,
				username,
				password: defaultPassword,
				isOnline: i % 2 === 0,
				lastSeen: new Date(Date.now() - (i % 7) * 24 * 60 * 60 * 1000),
			});
		}

		await prisma.user.createMany({
			data: userData,
			skipDuplicates: true,
		});

		const users = await prisma.user.findMany({
			where: {
				email: { in: userData.map(u => u.email) },
			},
		});

		return users;
	}

	/**
	 * Create friendships between users
	 */
	private async createFriendships(users: Array<{ id: string }>) {
		const friendshipData = [];

		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < users.length; j++) {
				if (Math.random() > 0.6) {
					friendshipData.push({
						requesterId: users[i].id,
						addresseeId: users[j].id,
					});
				}
			}
		}

		await prisma.friendship.createMany({
			data: friendshipData,
			skipDuplicates: true,
		});

		return friendshipData;
	}

	/**
	 * Create friend invites with different statuses
	 */
	private async createFriendInvites(users: Array<{ id: string }>) {
		const inviteData = [];
		const statuses: InviteStatus[] = [
			InviteStatus.PENDING,
			InviteStatus.ACCEPTED,
			InviteStatus.REJECTED,
		];

		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < users.length; j++) {
				if (Math.random() > 0.85) {
					const status = statuses[Math.floor(Math.random() * statuses.length)];
					inviteData.push({
						senderId: users[i].id,
						receiverId: users[j].id,
						status: status,
						createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
					});
				}
			}
		}

		await prisma.friendInvite.createMany({
			data: inviteData,
			skipDuplicates: true,
		});

		return inviteData;
	}

	/**
	 * Create chats between users
	 */
	private async createChats(users: Array<{ id: string }>) {
		const chats = [];
		const chatUserData = [];

		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < users.length; j++) {
				if (Math.random() > 0.5) {
					const chat = await prisma.chat.create({
						data: {
							isGroup: false,
						},
					});

					chatUserData.push(
						{
							chatId: chat.id,
							userId: users[i].id,
							role: ChatRole.USER,
						},
						{
							chatId: chat.id,
							userId: users[j].id,
							role: ChatRole.USER,
						},
					);

					chats.push(chat);
				}
			}
		}

		if (chatUserData.length > 0) {
			await prisma.chatUser.createMany({
				data: chatUserData,
				skipDuplicates: true,
			});
		}

		const groupChatNames = [
			'Friends Group',
			'Team Project',
			'Common Interests',
			'Family',
			'Programming Circle',
			'Student Group',
			'Book Club',
			'Fitness Team',
			'Travel Buddies',
			'Gaming Squad',
		];
		const groupChatSizes = [3, 4, 3, 4, 5, 4, 3, 4, 3, 5];

		for (let groupIndex = 0; groupIndex < groupChatNames.length; groupIndex++) {
			const groupSize = groupChatSizes[groupIndex] || 3;
			const startIndex = (groupIndex * 2) % users.length;
			let endIndex = startIndex + groupSize;

			if (endIndex > users.length) {
				endIndex = users.length;
			}

			if (endIndex - startIndex < 2) {
				const altStartIndex = 0;
				const altEndIndex = Math.min(groupSize, users.length);
				if (altEndIndex - altStartIndex >= 2) {
					try {
						const chat = await prisma.chat.create({
							data: {
								name: groupChatNames[groupIndex],
								isGroup: true,
								createdBy: users[altStartIndex].id,
							},
						});

						const chatUsersData = users.slice(altStartIndex, altEndIndex).map((user, index) => ({
							chatId: chat.id,
							userId: user.id,
							role: index === 0 ? ChatRole.OWNER : ChatRole.USER,
						}));

						await prisma.chatUser.createMany({
							data: chatUsersData,
						});

						chats.push(chat);
					} catch (error) {
						console.log(`Error creating group chat ${groupIndex}:`, error);
					}
				}
				continue;
			}

			if (endIndex > startIndex) {
				try {
					const chat = await prisma.chat.create({
						data: {
							name: groupChatNames[groupIndex],
							isGroup: true,
							createdBy: users[startIndex].id,
						},
					});

					const chatUsersData = users.slice(startIndex, endIndex).map((user, index) => ({
						chatId: chat.id,
						userId: user.id,
						role: index === 0 ? ChatRole.OWNER : ChatRole.USER,
					}));

					await prisma.chatUser.createMany({
						data: chatUsersData,
					});

					chats.push(chat);
				} catch (error) {
					console.log(`Error creating group chat ${groupIndex}:`, error);
				}
			}
		}

		return chats;
	}

	/**
	 * Create sample messages in chats
	 */
	private async createMessages(chats: Array<{ id: string }>, users: Array<{ id: string }>) {
		const allChatUsers = await prisma.chatUser.findMany({
			where: { chatId: { in: chats.map(c => c.id) } },
			select: { chatId: true, userId: true },
		});

		const chatUsersMap = new Map<string, string[]>();
		for (const cu of allChatUsers) {
			if (!chatUsersMap.has(cu.chatId)) {
				chatUsersMap.set(cu.chatId, []);
			}
			chatUsersMap.get(cu.chatId)!.push(cu.userId);
		}

		const sampleMessages = [
			'Hi! How are you?',
			'Everything is fine, and you?',
			'Great, thanks for asking!',
			'Can we meet tomorrow?',
			'Of course, what time?',
			'Maybe at 6:00 PM?',
			'Great, see you at 6:00 PM',
			'Nice to meet you!',
			"Thanks for today's meeting",
			'See you soon!',
			"What's up with you?",
			'Everything is good, work is going well',
			'Do you have any plans for the weekend?',
			"Yes, I'm going on a trip",
			'Nice! Good luck!',
			'Hey, have you seen this new movie?',
			'Yes, it was great! I recommend it!',
			'Exactly, I really liked it',
			'Where are we going today?',
			'Maybe for coffee?',
			'Great idea! What time?',
			'Shall we meet in an hour?',
			'Ok, see you!',
			'Can you send me that document?',
			"Of course, I'll send it to you right away",
			'Thanks a lot!',
			'Have you done that task yet?',
			'Almost done, just a moment',
			'Ok, let me know when you finish',
			'Already done, please check',
			'Great, looks awesome!',
			'We have a meeting tomorrow, remember?',
			'Yes, at 2:00 PM right?',
			'Exactly, see you there',
			'What are you doing on Saturday?',
			"I don't have plans yet, and you?",
			'Maybe we can go for a walk?',
			'Sounds good!',
			'Do you have that link?',
			"Yes, I'll send it to you right away",
			'Perfect, thanks!',
			'Have you read that book yet?',
			'Not yet, but I want to',
			"I really recommend it, it's great",
			"Ok, I'll definitely read it",
			'How was your day?',
			'Very good, and yours?',
			'Also great, thanks for asking',
			'Are you going to that party?',
			"Yes, I'll definitely be there",
			'Great, see you there',
			'Can you help me?',
			"Of course, what's happening?",
			"Thanks, that's very kind",
			'Where are you now?',
			"I'm at home, and you?",
			'Also at home, maybe we can meet?',
			"Ok, I'll come in a moment",
			'Do you have time for a conversation?',
			'Yes, I can now',
			"Great, I'll call right away",
			'What do you think about this idea?',
			"I think it's a good idea",
			'I agree with you',
			'Can we do this together?',
			"Of course, I'd be happy to help",
			'Thanks, it will be great collaboration',
			'When can we meet?',
			'Maybe next week?',
			"Ok, let's set a specific date",
			'Is everything okay?',
			'Yes, everything is ok, thanks',
			'Glad to hear that',
			'I have a surprise for you',
			"Oh wow, I'm curious!",
			"You'll see soon 😊",
			'Can you check this for me?',
			"Yes, I'll check right away",
			"Thanks, I'll wait",
			'What do you think about this change?',
			"I think it's a good decision",
			'Glad we agree',
			'Where do we want to go for lunch?',
			'Maybe to that new restaurant?',
			"Great idea, let's go there",
			'Can you remind me about this?',
			"Of course, I'll remind you",
			'Thanks, sometimes I forget',
			'How did you like it?',
			'I really liked it!',
			'Glad you liked it',
			'What are you planning for vacation?',
			"I don't know yet, and you?",
			"I'm thinking about going abroad",
			'Sounds exciting!',
		];

		const BATCH_SIZE = 100;
		const allMessageData: Array<{
			chatId: string;
			senderId: string;
			content: string;
			createdAt: Date;
			replyToId?: string;
			wasUpdated: boolean;
			editedAt?: Date;
		}> = [];

		for (const chat of chats) {
			const chatUserIds = chatUsersMap.get(chat.id);
			if (!chatUserIds || chatUserIds.length === 0) continue;

			const isGroupChat = chatUserIds.length > 2;
			const minMessages = isGroupChat ? 10 : 5;
			const maxMessages = isGroupChat ? 30 : 15;
			const messageCount = Math.floor(Math.random() * (maxMessages - minMessages + 1)) + minMessages;

			const baseTime = Date.now() - messageCount * 2 * 60 * 1000;
			const chatMessageData: Array<{
				chatId: string;
				senderId: string;
				content: string;
				createdAt: Date;
				replyToId?: string;
				wasUpdated: boolean;
				editedAt?: Date;
			}> = [];

			for (let i = 0; i < messageCount; i++) {
				const randomUserId = chatUserIds[Math.floor(Math.random() * chatUserIds.length)];
				const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

				const timeOffset = i * 2 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
				const createdAt = new Date(baseTime + timeOffset);

				let replyToId: string | undefined;
				let wasUpdated = false;
				let editedAt: Date | undefined;

				if (chatMessageData.length > 0 && Math.random() > 0.8) {
				}

				if (Math.random() > 0.9) {
					wasUpdated = true;
					editedAt = new Date(createdAt.getTime() + Math.random() * 60 * 60 * 1000);
				}

				chatMessageData.push({
					chatId: chat.id,
					senderId: randomUserId,
					content: randomMessage,
					createdAt: createdAt,
					replyToId: replyToId,
					wasUpdated: wasUpdated,
					editedAt: editedAt,
				});
			}

			allMessageData.push(...chatMessageData);
		}

		for (let i = 0; i < allMessageData.length; i += BATCH_SIZE) {
			const batch = allMessageData.slice(i, i + BATCH_SIZE);
			await prisma.message.createMany({
				data: batch,
				skipDuplicates: true,
			});
		}

		const allCreatedMessages = await prisma.message.findMany({
			where: {
				chatId: { in: chats.map(c => c.id) },
			},
			orderBy: { createdAt: 'asc' },
		});

		const messagesByChat = new Map<string, typeof allCreatedMessages>();
		for (const msg of allCreatedMessages) {
			if (!messagesByChat.has(msg.chatId)) {
				messagesByChat.set(msg.chatId, []);
			}
			messagesByChat.get(msg.chatId)!.push(msg);
		}

		const updates: Array<{ id: string; replyToId: string }> = [];
		for (const [chatId, chatMessages] of messagesByChat.entries()) {
			for (let i = 1; i < chatMessages.length; i++) {
				if (Math.random() > 0.8) {
					const previousMessage = chatMessages[Math.floor(Math.random() * i)];
					updates.push({
						id: chatMessages[i].id,
						replyToId: previousMessage.id,
					});
				}
			}
		}

		for (let i = 0; i < updates.length; i += BATCH_SIZE) {
			const batch = updates.slice(i, i + BATCH_SIZE);
			await Promise.all(
				batch.map(update =>
					prisma.message.update({
						where: { id: update.id },
						data: { replyToId: update.replyToId },
					}),
				),
			);
		}

		return allCreatedMessages;
	}

	/**
	 * Create message reactions
	 */
	private async createMessageReactions(
		messages: Array<{ id: string; senderId: string; createdAt: Date }>,
		users: Array<{ id: string }>,
	) {
		const emojis = [
			'👍',
			'❤️',
			'😊',
			'😂',
			'😮',
			'😢',
			'🔥',
			'👏',
			'🎉',
			'💯',
			'✅',
			'❌',
			'⭐',
			'💪',
			'🙌',
		];

		const reactionData = [];
		const BATCH_SIZE = 100;

		for (const message of messages) {
			if (Math.random() > 0.7) continue;

			const reactionCount = Math.floor(Math.random() * 3) + 1;
			const usersWhoReacted = new Set<string>();

			for (let i = 0; i < reactionCount; i++) {
				const randomUser = users[Math.floor(Math.random() * users.length)];

				if (randomUser.id === message.senderId) continue;
				if (usersWhoReacted.has(randomUser.id)) continue;

				usersWhoReacted.add(randomUser.id);

				const emoji = emojis[Math.floor(Math.random() * emojis.length)];

				reactionData.push({
					messageId: message.id,
					userId: randomUser.id,
					emoji: emoji,
					createdAt: new Date(message.createdAt.getTime() + Math.random() * 60 * 60 * 1000),
				});
			}
		}

		for (let i = 0; i < reactionData.length; i += BATCH_SIZE) {
			const batch = reactionData.slice(i, i + BATCH_SIZE);
			await prisma.messageReaction.createMany({
				data: batch,
				skipDuplicates: true,
			});
		}

		return reactionData;
	}

	/**
	 * Create message reads
	 */
	private async createMessageReads(
		messages: Array<{ id: string; chatId: string; senderId: string; createdAt: Date }>,
		chats: Array<{ id: string }>,
		users: Array<{ id: string }>,
	) {
		const allChatUsers = await prisma.chatUser.findMany({
			where: { chatId: { in: chats.map(c => c.id) } },
			select: { chatId: true, userId: true },
		});

		const chatUsersByChat = new Map<string, string[]>();
		for (const cu of allChatUsers) {
			if (!chatUsersByChat.has(cu.chatId)) {
				chatUsersByChat.set(cu.chatId, []);
			}
			chatUsersByChat.get(cu.chatId)!.push(cu.userId);
		}

		const messagesByChat = new Map<string, typeof messages>();
		for (const msg of messages) {
			if (!messagesByChat.has(msg.chatId)) {
				messagesByChat.set(msg.chatId, []);
			}
			messagesByChat.get(msg.chatId)!.push(msg);
		}

		const readData = [];
		const BATCH_SIZE = 100;

		for (const chat of chats) {
			const chatUserIds = chatUsersByChat.get(chat.id) || [];
			const chatMessages = messagesByChat.get(chat.id) || [];

			for (const chatUserId of chatUserIds) {
				const readCount = Math.floor(chatMessages.length * (0.3 + Math.random() * 0.2));
				const messagesToRead = chatMessages
					.filter(m => m.senderId !== chatUserId)
					.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
					.slice(0, readCount);

				for (const message of messagesToRead) {
					readData.push({
						messageId: message.id,
						userId: chatUserId,
						readAt: new Date(message.createdAt.getTime() + Math.random() * 5 * 60 * 1000),
					});
				}
			}
		}

		for (let i = 0; i < readData.length; i += BATCH_SIZE) {
			const batch = readData.slice(i, i + BATCH_SIZE);
			await prisma.messageRead.createMany({
				data: batch,
				skipDuplicates: true,
			});
		}

		return readData;
	}

	/**
	 * Create pinned messages
	 */
	private async createPinnedMessages(
		chats: Array<{ id: string }>,
		messages: Array<{ id: string; chatId: string; createdAt: Date }>,
		users: Array<{ id: string }>,
	) {
		const pinnedMessages = [];

		for (const chat of chats) {
			const chatMessages = messages.filter(m => m.chatId === chat.id);
			if (chatMessages.length === 0) continue;

			const chatUsers = await prisma.chatUser.findMany({
				where: { chatId: chat.id },
				select: { userId: true },
			});

			if (chatUsers.length === 0) continue;

			const pinCount = Math.floor(Math.random() * 3) + 1;

			for (let i = 0; i < pinCount && i < chatMessages.length; i++) {
				const messageToPin = chatMessages[Math.floor(Math.random() * chatMessages.length)];
				const userToPin = chatUsers[Math.floor(Math.random() * chatUsers.length)];

				try {
					const pinnedMessage = await prisma.pinnedMessage.create({
						data: {
							chatId: chat.id,
							messageId: messageToPin.id,
							pinnedById: userToPin.userId,
							pinnedAt: new Date(messageToPin.createdAt.getTime()),
						},
					});
					pinnedMessages.push(pinnedMessage);
				} catch (error) {
					console.log(`Error creating pinned message for chat ${chat.id}`);
				}
			}
		}

		return pinnedMessages;
	}

	/**
	 * Update ChatUser lastReadMessageId
	 */
	private async updateChatUserLastRead(
		chats: Array<{ id: string }>,
		messages: Array<{ id: string; chatId: string; createdAt: Date }>,
	) {
		for (const chat of chats) {
			const chatUsers = await prisma.chatUser.findMany({
				where: { chatId: chat.id },
			});

			const chatMessages = messages
				.filter(m => m.chatId === chat.id)
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

			if (chatMessages.length === 0) continue;

			for (const chatUser of chatUsers) {
				const readMessages = await prisma.messageRead.findMany({
					where: {
						userId: chatUser.userId,
						messageId: { in: chatMessages.map(m => m.id) },
					},
					orderBy: { readAt: 'desc' },
					take: 1,
				});

				if (readMessages.length > 0) {
					await prisma.chatUser.update({
						where: { id: chatUser.id },
						data: {
							lastReadMessageId: readMessages[0].messageId,
							lastReadAt: readMessages[0].readAt,
						},
					});
				} else if (chatMessages.length > 0) {
					const randomMessage = chatMessages[Math.floor(Math.random() * chatMessages.length)];
					await prisma.chatUser.update({
						where: { id: chatUser.id },
						data: {
							lastReadMessageId: randomMessage.id,
							lastReadAt: randomMessage.createdAt,
						},
					});
				}
			}
		}
	}

	/**
	 * Clear only seeded data (users, friendships, chats, messages)
	 */
	async clearSeededData(): Promise<void> {
		await prisma.$transaction([
			prisma.messageReaction.deleteMany(),
			prisma.messageRead.deleteMany(),
			prisma.pinnedMessage.deleteMany(),
			prisma.message.deleteMany(),
			prisma.chatUser.deleteMany(),
			prisma.chat.deleteMany(),
			prisma.friendship.deleteMany(),
			prisma.friendInvite.deleteMany(),
			prisma.refreshToken.deleteMany(),
			prisma.user.deleteMany(),
		]);
	}
}
