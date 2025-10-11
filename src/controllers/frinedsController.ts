import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { inviteFriendSchema } from "../utils/validationSchemas";

const prisma = new PrismaClient();

export async function getFriends(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Brak autoryzacji użytkownika'
            });
            return;
        }

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

        // Przekształć dane, aby zwrócić informacje o znajomych (nie o relacji)
        const friends = friendships.map(friendship => {
            // Jeśli użytkownik jest requesterem, zwróć addressee jako znajomego
            if (friendship.requesterId === userId) {
                return {
                    id: friendship.addressee.id,
                    username: friendship.addressee.username,
                    email: friendship.addressee.email,
                    isOnline: friendship.addressee.isOnline,
                    lastSeen: friendship.addressee.lastSeen,
                    createdAt: friendship.addressee.createdAt,
                    friendshipCreatedAt: friendship.createdAt
                };
            } else {
                // Jeśli użytkownik jest addressee, zwróć requester jako znajomego
                return {
                    id: friendship.requester.id,
                    username: friendship.requester.username,
                    email: friendship.requester.email,
                    isOnline: friendship.requester.isOnline,
                    lastSeen: friendship.requester.lastSeen,
                    createdAt: friendship.requester.createdAt,
                    friendshipCreatedAt: friendship.createdAt
                };
            }
        });

        res.status(200).json({
            success: true,
            message: 'Znajomi pobrani pomyślnie',
            data: {
                friends,
                count: friends.length
            }
        });

    } catch (error) {
        next(error);
        return;
    }
}

export async function inviteFriend(req: Request, res: Response, next: NextFunction) {
    try {
        const senderId = req.user?.userId;

        if (!senderId) {
            res.status(401).json({
                success: false,
                message: 'Brak autoryzacji użytkownika'
            });
            return;
        }

        // Walidacja danych wejściowych
        const validationResult = inviteFriendSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                success: false,
                message: 'Nieprawidłowe dane',
                errors: validationResult.error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            return;
        }

        const { username } = validationResult.data;

        // Sprawdź czy użytkownik nie próbuje zaprosić samego siebie
        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            select: { username: true }
        });

        if (!sender) {
            res.status(404).json({
                success: false,
                message: 'Użytkownik nie został znaleziony'
            });
            return;
        }

        if (sender.username === username) {
            res.status(400).json({
                success: false,
                message: 'Nie możesz zaprosić samego siebie'
            });
            return;
        }

        // Znajdź użytkownika do zaproszenia
        const receiver = await prisma.user.findUnique({
            where: { username },
            select: { id: true, username: true, email: true }
        });

        if (!receiver) {
            res.status(404).json({
                success: false,
                message: 'Użytkownik o podanej nazwie nie istnieje'
            });
            return;
        }

        // Sprawdź czy już są znajomymi
        const existingFriendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: senderId, addresseeId: receiver.id },
                    { requesterId: receiver.id, addresseeId: senderId }
                ],
                deletedAt: null
            }
        });

        if (existingFriendship) {
            res.status(400).json({
                success: false,
                message: 'Już jesteście znajomymi'
            });
            return;
        }

        // Sprawdź czy nie ma już oczekującego zaproszenia
        const existingInvite = await prisma.friendInvite.findFirst({
            where: {
                OR: [
                    { senderId, receiverId: receiver.id },
                    { senderId: receiver.id, receiverId: senderId }
                ],
                status: 'PENDING',
                deletedAt: null
            }
        });

        if (existingInvite) {
            res.status(400).json({
                success: false,
                message: 'Zaproszenie już zostało wysłane lub otrzymane'
            });
            return;
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

        res.status(201).json({
            success: true,
            message: `Zaproszenie zostało wysłane do ${receiver.username}`,
            data: {
                invite: {
                    id: invite.id,
                    status: invite.status,
                    createdAt: invite.createdAt,
                    receiver: {
                        id: invite.receiver.id,
                        username: invite.receiver.username,
                        email: invite.receiver.email
                    }
                }
            }
        });

    } catch (error) {
        next(error);
        return;
    }
}

export async function getInvites(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Brak autoryzacji użytkownika'
            });
            return;
        }

        // Pobierz wszystkie zaproszenia dla użytkownika (wysłane i otrzymane)
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

        // Podziel zaproszenia na wysłane i otrzymane
        const sentInvites = invites
            .filter(invite => invite.senderId === userId)
            .map(invite => ({
                id: invite.id,
                status: invite.status,
                createdAt: invite.createdAt,
                receiver: {
                    id: invite.receiver.id,
                    username: invite.receiver.username,
                    email: invite.receiver.email,
                    isOnline: invite.receiver.isOnline,
                    lastSeen: invite.receiver.lastSeen,
                    createdAt: invite.receiver.createdAt
                }
            }));

        const receivedInvites = invites
            .filter(invite => invite.receiverId === userId)
            .map(invite => ({
                id: invite.id,
                status: invite.status,
                createdAt: invite.createdAt,
                sender: {
                    id: invite.sender.id,
                    username: invite.sender.username,
                    email: invite.sender.email,
                    isOnline: invite.sender.isOnline,
                    lastSeen: invite.sender.lastSeen,
                    createdAt: invite.sender.createdAt
                }
            }));

        res.status(200).json({
            success: true,
            message: 'Zaproszenia pobrane pomyślnie',
            data: {
                sentInvites,
                receivedInvites,
                totalSent: sentInvites.length,
                totalReceived: receivedInvites.length,
                totalPending: receivedInvites.filter(invite => invite.status === 'PENDING').length
            }
        });

    } catch (error) {
        next(error);
        return;
    }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
        const currentUserId = req.user?.userId;
        const inviteId = req.params.id;

        if (!currentUserId) {
            res.status(401).json({
                success: false,
                message: 'Brak autoryzacji użytkownika'
            });
            return;
        }

        if (!inviteId) {
            res.status(400).json({
                success: false,
                message: 'Brak ID zaproszenia'
            });
            return;
        }

        // Znajdź zaproszenie
        const invite = await prisma.friendInvite.findUnique({
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

        if (!invite) {
            res.status(404).json({
                success: false,
                message: 'Zaproszenie nie zostało znalezione'
            });
            return;
        }

        // Sprawdź czy użytkownik może zaakceptować to zaproszenie
        if (invite.receiverId !== currentUserId) {
            res.status(403).json({
                success: false,
                message: 'Nie masz uprawnień do zaakceptowania tego zaproszenia'
            });
            return;
        }

        // Sprawdź czy zaproszenie jest w stanie PENDING
        if (invite.status !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: 'Zaproszenie nie może być zaakceptowane'
            });
            return;
        }

        // Sprawdź czy już nie są znajomymi
        const existingFriendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: invite.senderId, addresseeId: invite.receiverId },
                    { requesterId: invite.receiverId, addresseeId: invite.senderId }
                ],
                deletedAt: null
            }
        });

        if (existingFriendship) {
            res.status(400).json({
                success: false,
                message: 'Już jesteście znajomymi'
            });
            return;
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

        res.status(200).json({
            success: true,
            message: `Zaakceptowano zaproszenie od ${invite.sender.username}`,
            data: {
                friendship: {
                    requester: {
                        id: invite.sender.id,
                        username: invite.sender.username,
                        email: invite.sender.email
                    },
                    addressee: {
                        id: invite.receiver.id,
                        username: invite.receiver.username,
                        email: invite.receiver.email
                    }
                }
            }
        });

    } catch (error) {
        next(error);
        return;
    }
}

export async function rejectInvite(req: Request, res: Response, next: NextFunction) {
    try {
        const currentUserId = req.user?.userId;
        const inviteId = req.params.id;

        if (!currentUserId) {
            res.status(401).json({
                success: false,
                message: 'Brak autoryzacji użytkownika'
            });
            return;
        }

        if (!inviteId) {
            res.status(400).json({
                success: false,
                message: 'Brak ID zaproszenia'
            });
            return;
        }

        // Znajdź zaproszenie
        const invite = await prisma.friendInvite.findUnique({
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

        if (!invite) {
            res.status(404).json({
                success: false,
                message: 'Zaproszenie nie zostało znalezione'
            });
            return;
        }

        // Sprawdź czy użytkownik może odrzucić to zaproszenie
        if (invite.receiverId !== currentUserId) {
            res.status(403).json({
                success: false,
                message: 'Nie masz uprawnień do odrzucenia tego zaproszenia'
            });
            return;
        }

        // Sprawdź czy zaproszenie jest w stanie PENDING
        if (invite.status !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: 'Zaproszenie nie może być odrzucone'
            });
            return;
        }

        // Zaktualizuj status zaproszenia na REJECTED
        await prisma.friendInvite.update({
            where: { id: inviteId },
            data: { 
                status: 'REJECTED',
                updatedBy: currentUserId
            }
        });

        res.status(200).json({
            success: true,
            message: `Odrzucono zaproszenie od ${invite.sender.username}`,
            data: {
                invite: {
                    id: invite.id,
                    status: 'REJECTED',
                    sender: {
                        id: invite.sender.id,
                        username: invite.sender.username,
                        email: invite.sender.email
                    }
                }
            }
        });

    } catch (error) {
        next(error);
        return;
    }
}

export async function deleteFriend(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.params.id;
    } catch (error) {
        next(error);
        return;
    }
}