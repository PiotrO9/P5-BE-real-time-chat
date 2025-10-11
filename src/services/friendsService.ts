import { PrismaClient } from '@prisma/client';
import { 
  User, 
  Friend, 
  FriendInviteResponse, 
  SentInvite, 
  ReceivedInvite, 
  InvitesResponse, 
  FriendshipResponse 
} from '../types/friends';

const prisma = new PrismaClient();

export class FriendsService {
  /**
   * Pobiera wszystkich znajomych użytkownika
   */
  async getFriends(userId: string): Promise<Friend[]> {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId }
        ],
        deletedAt: null
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
            isOnline: true,
            lastSeen: true,
            createdAt: true
          }
        },
        addressee: {
          select: {
            id: true,
            username: true,
            email: true,
            isOnline: true,
            lastSeen: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return friendships.map(friendship => {
      if (friendship.requesterId === userId) {
        return {
          ...friendship.addressee,
          friendshipCreatedAt: friendship.createdAt
        };
      } else {
        return {
          ...friendship.requester,
          friendshipCreatedAt: friendship.createdAt
        };
      }
    });
  }

  /**
   * Wysyła zaproszenie do znajomych
   */
  async inviteFriend(senderId: string, username: string): Promise<FriendInviteResponse> {
    // Sprawdź czy użytkownik nie próbuje zaprosić samego siebie
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { username: true }
    });

    if (!sender) {
      throw new Error('Użytkownik nie został znaleziony');
    }

    if (sender.username === username) {
      throw new Error('Nie możesz zaprosić samego siebie');
    }

    // Znajdź użytkownika do zaproszenia
    const receiver = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, email: true }
    });

    if (!receiver) {
      throw new Error('Użytkownik o podanej nazwie nie istnieje');
    }

    // Sprawdź czy już są znajomymi
    const existingFriendship = await this.checkExistingFriendship(senderId, receiver.id);
    if (existingFriendship) {
      throw new Error('Już jesteście znajomymi');
    }

    // Sprawdź czy nie ma już oczekującego zaproszenia
    const existingInvite = await this.checkExistingInvite(senderId, receiver.id);
    if (existingInvite) {
      throw new Error('Zaproszenie już zostało wysłane lub otrzymane');
    }

    // Utwórz nowe zaproszenie
    const invite = await prisma.friendInvite.create({
      data: {
        senderId,
        receiverId: receiver.id,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return {
      id: invite.id,
      status: invite.status,
      createdAt: invite.createdAt,
      receiver: invite.receiver
    };
  }

  /**
   * Pobiera wszystkie zaproszenia użytkownika
   */
  async getInvites(userId: string): Promise<InvitesResponse> {
    const invites = await prisma.friendInvite.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ],
        deletedAt: null
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            isOnline: true,
            lastSeen: true,
            createdAt: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            isOnline: true,
            lastSeen: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const sentInvites: SentInvite[] = invites
      .filter(invite => invite.senderId === userId)
      .map(invite => ({
        id: invite.id,
        status: invite.status,
        createdAt: invite.createdAt,
        receiver: invite.receiver
      }));

    const receivedInvites: ReceivedInvite[] = invites
      .filter(invite => invite.receiverId === userId)
      .map(invite => ({
        id: invite.id,
        status: invite.status,
        createdAt: invite.createdAt,
        sender: invite.sender
      }));

    return {
      sentInvites,
      receivedInvites,
      totalSent: sentInvites.length,
      totalReceived: receivedInvites.length,
      totalPending: receivedInvites.filter(invite => invite.status === 'PENDING').length
    };
  }

  /**
   * Akceptuje zaproszenie do znajomych
   */
  async acceptInvite(inviteId: string, currentUserId: string): Promise<FriendshipResponse> {
    const invite = await this.findInviteById(inviteId);

    if (!invite) {
      throw new Error('Zaproszenie nie zostało znalezione');
    }

    if (invite.receiverId !== currentUserId) {
      throw new Error('Nie masz uprawnień do zaakceptowania tego zaproszenia');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Zaproszenie nie może być zaakceptowane');
    }

    // Sprawdź czy już nie są znajomymi
    const existingFriendship = await this.checkExistingFriendship(invite.senderId, invite.receiverId);
    if (existingFriendship) {
      throw new Error('Już jesteście znajomymi');
    }

    // Rozpocznij transakcję
    await prisma.$transaction(async (tx) => {
      // Zaktualizuj status zaproszenia na ACCEPTED
      await tx.friendInvite.update({
        where: { id: inviteId },
        data: { 
          status: 'ACCEPTED',
          updatedBy: currentUserId
        }
      });

      // Utwórz relację znajomości
      await tx.friendship.create({
        data: {
          requesterId: invite.senderId,
          addresseeId: invite.receiverId,
          createdBy: currentUserId
        }
      });
    });

    return {
      requester: invite.sender,
      addressee: invite.receiver
    };
  }

  /**
   * Odrzuca zaproszenie do znajomych
   */
  async rejectInvite(inviteId: string, currentUserId: string): Promise<FriendInviteResponse> {
    const invite = await this.findInviteById(inviteId);

    if (!invite) {
      throw new Error('Zaproszenie nie zostało znalezione');
    }

    if (invite.receiverId !== currentUserId) {
      throw new Error('Nie masz uprawnień do odrzucenia tego zaproszenia');
    }

    if (invite.status !== 'PENDING') {
      throw new Error('Zaproszenie nie może być odrzucone');
    }

    // Zaktualizuj status zaproszenia na REJECTED
    await prisma.friendInvite.update({
      where: { id: inviteId },
      data: { 
        status: 'REJECTED',
        updatedBy: currentUserId
      }
    });

    return {
      id: invite.id,
      status: 'REJECTED',
      createdAt: invite.createdAt,
      sender: invite.sender
    };
  }

  /**
   * Usuwa znajomego
   */
  async deleteFriend(friendId: string, currentUserId: string): Promise<User> {
    if (currentUserId === friendId) {
      throw new Error('Nie możesz usunąć samego siebie z listy znajomych');
    }

    // Znajdź znajomość między użytkownikami
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: currentUserId }
        ],
        deletedAt: null
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        addressee: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!friendship) {
      throw new Error('Znajomość nie została znaleziona');
    }

    // Wykonaj soft delete znajomości
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: {
        deletedAt: new Date(),
        updatedBy: currentUserId
      }
    });

    // Określ który użytkownik został usunięty jako znajomy
    return friendship.requesterId === currentUserId 
      ? friendship.addressee 
      : friendship.requester;
  }

  // Prywatne metody pomocnicze
  private async checkExistingFriendship(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId1, addresseeId: userId2 },
          { requesterId: userId2, addresseeId: userId1 }
        ],
        deletedAt: null
      }
    });

    return !!friendship;
  }

  private async checkExistingInvite(senderId: string, receiverId: string): Promise<boolean> {
    const invite = await prisma.friendInvite.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ],
        status: 'PENDING',
        deletedAt: null
      }
    });

    return !!invite;
  }

  private async findInviteById(inviteId: string) {
    return await prisma.friendInvite.findUnique({
      where: {
        id: inviteId,
        deletedAt: null
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });
  }
}
