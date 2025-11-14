import bcrypt from 'bcrypt';
import { PrismaClient, ChatRole } from '@prisma/client';

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
			chats: number;
			messages: number;
		};
	}> {
		const DEFAULT_PASSWORD = 'password123';

		await this.clearDatabase();

		const users = await this.createUsers(DEFAULT_PASSWORD);

		const friendships = await this.createFriendships(users);

		const chats = await this.createChats(users);

		const messages = await this.createMessages(chats, users);

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
				chats: chats.length,
				messages: messages.length,
			},
		};
	}

	/**
	 * Clear all seeded data
	 */
	private async clearDatabase(): Promise<void> {
		await prisma.messageReaction.deleteMany();
		await prisma.messageRead.deleteMany();
		await prisma.pinnedMessage.deleteMany();
		await prisma.message.deleteMany();
		await prisma.chatUser.deleteMany();
		await prisma.chat.deleteMany();
		await prisma.friendship.deleteMany();
		await prisma.friendInvite.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.user.deleteMany();
	}

	/**
	 * Create sample users
	 */
	private async createUsers(plainPassword: string) {
		const saltRounds = 12;
		const defaultPassword = await bcrypt.hash(plainPassword, saltRounds);

		const userData = [
			{ email: 'jan.kowalski@example.com', username: 'jankowalski' },
			{ email: 'anna.nowak@example.com', username: 'annanowak' },
			{ email: 'piotr.wisniewski@example.com', username: 'piotrwisniewski' },
			{ email: 'maria.wojcik@example.com', username: 'mariawojcik' },
			{ email: 'tomasz.lewandowski@example.com', username: 'tomaszlewandowski' },
			{ email: 'katarzyna.zielinska@example.com', username: 'katarzynazielinska' },
			{ email: 'andrzej.szymanski@example.com', username: 'andrzej.szymanski' },
			{ email: 'magdalena.dabrowski@example.com', username: 'magdalenadabrowski' },
		];

		const users = await Promise.all(
			userData.map(user =>
				prisma.user.create({
					data: {
						email: user.email,
						username: user.username,
						password: defaultPassword,
						isOnline: Math.random() > 0.5,
						lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
					},
				}),
			),
		);

		return users;
	}

	/**
	 * Create friendships between users
	 */
	private async createFriendships(users: Array<{ id: string }>) {
		const friendships = [];

		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < Math.min(i + 3, users.length); j++) {
				if (Math.random() > 0.3) {
					try {
						const friendship = await prisma.friendship.create({
							data: {
								requesterId: users[i].id,
								addresseeId: users[j].id,
							},
						});
						friendships.push(friendship);
					} catch (error) {
						console.log(`Friendship already exists between users ${i} and ${j}`);
					}
				}
			}
		}

		return friendships;
	}

	/**
	 * Create chats between users
	 */
	private async createChats(users: Array<{ id: string }>) {
		const chats = [];

		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < users.length; j++) {
				if (Math.random() > 0.25) {
					try {
						const chat = await prisma.chat.create({
							data: {
								isGroup: false,
							},
						});

						await prisma.chatUser.createMany({
							data: [
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
							],
						});

						chats.push(chat);
					} catch (error) {
						console.log(`Error creating chat between users ${i} and ${j}:`, error);
					}
				}
			}
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
		const messages = [];
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

		for (const chat of chats) {
			const chatUsers = await prisma.chatUser.findMany({
				where: { chatId: chat.id },
				select: { userId: true },
			});

			if (chatUsers.length === 0) continue;

			const isGroupChat = chatUsers.length > 2;
			const minMessages = isGroupChat ? 10 : 5;
			const maxMessages = isGroupChat ? 30 : 20;
			const messageCount = Math.floor(Math.random() * (maxMessages - minMessages + 1)) + minMessages;

			const baseTime = Date.now() - messageCount * 2 * 60 * 1000;

			for (let i = 0; i < messageCount; i++) {
				const randomUser = chatUsers[Math.floor(Math.random() * chatUsers.length)];
				const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

				const timeOffset = i * 2 * 60 * 1000 + Math.random() * 5 * 60 * 1000;

				const message = await prisma.message.create({
					data: {
						chatId: chat.id,
						senderId: randomUser.userId,
						content: randomMessage,
						createdAt: new Date(baseTime + timeOffset),
					},
				});

				messages.push(message);
			}
		}

		return messages;
	}

	/**
	 * Clear only seeded data (users, friendships, chats, messages)
	 */
	async clearSeededData(): Promise<void> {
		await prisma.messageReaction.deleteMany();
		await prisma.messageRead.deleteMany();
		await prisma.pinnedMessage.deleteMany();
		await prisma.message.deleteMany();
		await prisma.chatUser.deleteMany();
		await prisma.chat.deleteMany();
		await prisma.friendship.deleteMany();
		await prisma.friendInvite.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.user.deleteMany();
	}
}
