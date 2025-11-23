"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_1 = require("../../../src/utils/jwt");
describe('JWT Utils - Unit Tests', () => {
    const mockPayload = {
        userId: '123',
        email: 'test@example.com',
    };
    describe('generateAccessToken', () => {
        it('should generate a valid access token', () => {
            const token = (0, jwt_1.generateAccessToken)(mockPayload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
    });
    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token', () => {
            const token = (0, jwt_1.generateRefreshToken)(mockPayload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
    });
    describe('verifyAccessToken', () => {
        it('should verify a valid access token', () => {
            const token = (0, jwt_1.generateAccessToken)(mockPayload);
            const decoded = (0, jwt_1.verifyAccessToken)(token);
            expect(decoded.userId).toBe(mockPayload.userId);
            expect(decoded.email).toBe(mockPayload.email);
        });
        it('should throw error for invalid token', () => {
            expect(() => {
                (0, jwt_1.verifyAccessToken)('invalid-token');
            }).toThrow('Invalid access token');
        });
    });
    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', () => {
            const token = (0, jwt_1.generateRefreshToken)(mockPayload);
            const decoded = (0, jwt_1.verifyRefreshToken)(token);
            expect(decoded.userId).toBe(mockPayload.userId);
            expect(decoded.email).toBe(mockPayload.email);
        });
        it('should throw error for invalid token', () => {
            expect(() => {
                (0, jwt_1.verifyRefreshToken)('invalid-token');
            }).toThrow('Invalid refresh token');
        });
    });
});
//# sourceMappingURL=jwt.test.js.map