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

		// Clear existing data (optional - comment out if you want to keep existing data)
		await this.clearDatabase();

		// Create users
		const users = await this.createUsers(DEFAULT_PASSWORD);

		// Create friendships
		const friendships = await this.createFriendships(users);

		// Create chats
		const chats = await this.createChats(users);

		// Create messages in chats
		const messages = await this.createMessages(chats, users);

		// Return user list with email and username (without sensitive data)
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

		// Create some friendships - connect users in pairs and some groups
		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < Math.min(i + 3, users.length); j++) {
				if (Math.random() > 0.3) {
					// 70% chance of friendship
					try {
						const friendship = await prisma.friendship.create({
							data: {
								requesterId: users[i].id,
								addresseeId: users[j].id,
							},
						});
						friendships.push(friendship);
					} catch (error) {
						// Friendship might already exist, skip
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

		// Create 1-on-1 chats for more user pairs (increased coverage)
		for (let i = 0; i < users.length; i++) {
			for (let j = i + 1; j < users.length; j++) {
				if (Math.random() > 0.25) {
					// 75% chance of 1-on-1 chat (increased from 60%)
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

		// Create more group chats with varied sizes
		const groupChatNames = [
			'Grupa Przyjaciół',
			'Team Project',
			'Wspólne Zainteresowania',
			'Rodzina',
			'Kółko Programistyczne',
			'Grupa Studencka',
			'Book Club',
			'Fitness Team',
			'Travel Buddies',
			'Gaming Squad',
		];
		const groupChatSizes = [3, 4, 3, 4, 5, 4, 3, 4, 3, 5];

		// Create group chats with different user combinations
		for (let groupIndex = 0; groupIndex < groupChatNames.length; groupIndex++) {
			const groupSize = groupChatSizes[groupIndex] || 3;
			// Vary the start index to create different group combinations
			const startIndex = (groupIndex * 2) % users.length;
			let endIndex = startIndex + groupSize;

			// If we exceed user array, wrap around or adjust
			if (endIndex > users.length) {
				endIndex = users.length;
			}

			// If group would be too small, skip
			if (endIndex - startIndex < 2) {
				// Try alternative grouping
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
			'Cześć! Jak się masz?',
			'Wszystko w porządku, a Ty?',
			'Super, dzięki za pytanie!',
			'Czy możemy umówić się na jutro?',
			'Oczywiście, o której?',
			'Może o 18:00?',
			'Świetnie, spotykamy się o 18:00',
			'Miło było Cię poznać!',
			'Dzięki za dzisiejsze spotkanie',
			'Do zobaczenia wkrótce!',
			'Co u Ciebie słychać?',
			'Wszystko gra, praca idzie dobrze',
			'Masz jakieś plany na weekend?',
			'Tak, wybieram się na wycieczkę',
			'Fajnie! Powodzenia!',
			'Hej, widziałeś ten nowy film?',
			'Tak, był świetny! Polecam!',
			'Dokładnie, bardzo mi się podobał',
			'Gdzie idziemy dzisiaj?',
			'Może na kawę?',
			'Świetny pomysł! O której?',
			'Spotykamy się za godzinę?',
			'Ok, widzimy się!',
			'Czy możesz przesłać mi ten dokument?',
			'Oczywiście, zaraz Ci wyślę',
			'Dzięki wielkie!',
			'Zrobiłeś już to zadanie?',
			'Prawie skończone, jeszcze chwilę',
			'Ok, daj znać jak skończysz',
			'Już gotowe, sprawdź proszę',
			'Super, wygląda świetnie!',
			'Mamy jutro spotkanie, pamiętasz?',
			'Tak, o 14:00 prawda?',
			'Dokładnie, widzimy się tam',
			'Co robisz w sobotę?',
			'Jeszcze nie mam planów, a Ty?',
			'Może pójdziemy na spacer?',
			'Brzmi dobrze!',
			'Czy masz może ten link?',
			'Tak, zaraz Ci go prześlę',
			'Perfekcyjnie, dzięki!',
			'Czytałeś już tę książkę?',
			'Jeszcze nie, ale chcę',
			'Naprawdę polecam, jest świetna',
			'Ok, na pewno przeczytam',
			'Jak minął Ci dzień?',
			'Bardzo dobrze, a Tobie?',
			'Też super, dzięki za pytanie',
			'Idziesz na tę imprezę?',
			'Tak, będę tam na pewno',
			'Świetnie, zobaczymy się tam',
			'Czy możesz mi pomóc?',
			'Oczywiście, co się dzieje?',
			'Dzięki, to bardzo miłe',
			'Gdzie jesteś teraz?',
			'Jestem w domu, a Ty?',
			'Też w domu, może spotkamy się?',
			'Ok, przyjdę za chwilę',
			'Czy masz może czas na rozmowę?',
			'Tak, mogę teraz',
			'Świetnie, dzwonię zaraz',
			'Co sądzisz o tym pomyśle?',
			'Myślę, że to dobry pomysł',
			'Zgadzam się z Tobą',
			'Czy możemy to zrobić razem?',
			'Oczywiście, chętnie pomogę',
			'Dzięki, to będzie fajna współpraca',
			'Kiedy możemy się spotkać?',
			'Może w przyszłym tygodniu?',
			'Ok, ustalmy konkretny termin',
			'Czy wszystko w porządku?',
			'Tak, wszystko ok, dzięki',
			'Cieszę się, że słyszę',
			'Mam dla Ciebie niespodziankę',
			'O rany, jestem ciekaw!',
			'Zobaczysz wkrótce 😊',
			'Czy możesz sprawdzić to dla mnie?',
			'Tak, sprawdzę zaraz',
			'Dzięki, będę czekać',
			'Co sądzisz o tej zmianie?',
			'Myślę, że to dobra decyzja',
			'Cieszę się, że się zgadzamy',
			'Gdzie chcemy iść na obiad?',
			'Może do tej nowej restauracji?',
			'Świetny pomysł, idziemy tam',
			'Czy możesz przypomnieć mi o tym?',
			'Oczywiście, przypomnę',
			'Dzięki, czasem zapominam',
			'Jak Ci się podobało?',
			'Bardzo mi się podobało!',
			'Cieszę się, że Ci się podobało',
			'Co planujesz na wakacje?',
			'Jeszcze nie wiem, a Ty?',
			'Myślę o wyjeździe za granicę',
			'Brzmi ekscytująco!',
		];

		// Create messages in all chats, not just first 5
		for (const chat of chats) {
			// Get users in this chat
			const chatUsers = await prisma.chatUser.findMany({
				where: { chatId: chat.id },
				select: { userId: true },
			});

			if (chatUsers.length === 0) continue;

			// Create more messages per chat (5-20 for regular chats, 10-30 for group chats)
			const isGroupChat = chatUsers.length > 2;
			const minMessages = isGroupChat ? 10 : 5;
			const maxMessages = isGroupChat ? 30 : 20;
			const messageCount = Math.floor(Math.random() * (maxMessages - minMessages + 1)) + minMessages;

			// Create messages with realistic time distribution
			const baseTime = Date.now() - messageCount * 2 * 60 * 1000; // Messages spread over last few hours

			for (let i = 0; i < messageCount; i++) {
				const randomUser = chatUsers[Math.floor(Math.random() * chatUsers.length)];
				const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

				// Create messages with variable time gaps (some close together, some further apart)
				const timeOffset = i * 2 * 60 * 1000 + Math.random() * 5 * 60 * 1000; // 2-7 minutes between messages

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
		await prisma.message.deleteMany();
		await prisma.chatUser.deleteMany();
		await prisma.chat.deleteMany();
		await prisma.friendship.deleteMany();
		await prisma.friendInvite.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.user.deleteMany();
	}
}
