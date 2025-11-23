"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestUser = createTestUser;
exports.generateTestToken = generateTestToken;
exports.createAuthHeaders = createAuthHeaders;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const jwt_1 = require("../../src/utils/jwt");
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
    },
});
async function createTestUser(data) {
    const email = data?.email || `test${Date.now()}@example.com`;
    const username = data?.username || `testuser${Date.now()}`;
    const password = data?.password || 'password123';
    const hashedPassword = await bcrypt_1.default.hash(password, 12);
    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword,
        },
    });
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        password,
    };
}
function generateTestToken(payload) {
    return (0, jwt_1.generateAccessToken)(payload);
}
function createAuthHeaders(userId, email) {
    const token = generateTestToken({ userId, email });
    return {
        Cookie: `accessToken=${token}`,
    };
}
//# sourceMappingURL=testHelpers.js.map