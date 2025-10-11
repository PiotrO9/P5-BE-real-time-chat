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
        const userId = req.params.id;
    } catch (error) {
        next(error);
        return;
    }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.params.id;
    } catch (error) {
        next(error);
        return;
    }
}

export async function rejectInvite(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.params.id;
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