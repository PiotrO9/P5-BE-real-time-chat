"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDatabase = cleanDatabase;
exports.closeDatabase = closeDatabase;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
    },
});
async function cleanDatabase() {
    try {
        await prisma.messageReaction.deleteMany().catch(() => { });
        await prisma.messageRead.deleteMany().catch(() => { });
        await prisma.message.deleteMany().catch(() => { });
        await prisma.chatUser.deleteMany().catch(() => { });
        await prisma.chat.deleteMany().catch(() => { });
        await prisma.friendInvite.deleteMany().catch(() => { });
        await prisma.friendship.deleteMany().catch(() => { });
        await prisma.refreshToken.deleteMany().catch(() => { });
        await prisma.user.deleteMany().catch(() => { });
    }
    catch (error) {
        console.warn('Warning: Some tables may not exist yet:', error);
    }
}
async function closeDatabase() {
    await prisma.$disconnect();
}
//# sourceMappingURL=testDatabase.js.map