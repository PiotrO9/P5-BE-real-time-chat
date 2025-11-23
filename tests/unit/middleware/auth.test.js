"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../../src/middleware/auth");
const jwt_1 = require("../../../src/utils/jwt");
jest.mock('../../../src/utils/jwt', () => ({
    verifyAccessToken: jest.fn(),
    generateAccessToken: jest.fn(),
    SLIDING_SESSION_ENABLED: true,
}));
const mockVerifyAccessToken = jwt_1.verifyAccessToken;
const mockGenerateAccessToken = jwt_1.generateAccessToken;
describe('Auth Middleware - Unit Tests', () => {
    let mockRequest;
    let mockResponse;
    let mockNext;
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequest = {
            cookies: {},
            params: {},
            user: undefined,
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
    });
    describe('authenticateToken', () => {
        it('should return 401 when access token is missing', () => {
            mockRequest.cookies = {};
            (0, auth_1.authenticateToken)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Access token required',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should authenticate user with valid token and refresh token', () => {
            const mockPayload = { userId: '123', email: 'test@example.com' };
            const newToken = 'new-access-token';
            mockRequest.cookies = { accessToken: 'valid-token' };
            mockVerifyAccessToken.mockReturnValue(mockPayload);
            mockGenerateAccessToken.mockReturnValue(newToken);
            (0, auth_1.authenticateToken)(mockRequest, mockResponse, mockNext);
            expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
            expect(mockRequest.user).toEqual(mockPayload);
            expect(mockGenerateAccessToken).toHaveBeenCalledWith(mockPayload);
            expect(mockResponse.cookie).toHaveBeenCalledWith('accessToken', newToken, expect.objectContaining({
                httpOnly: true,
                sameSite: 'strict',
            }));
            expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Token-Refreshed', 'true');
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 403 when token is invalid', () => {
            mockRequest.cookies = { accessToken: 'invalid-token' };
            mockVerifyAccessToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            (0, auth_1.authenticateToken)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid or expired access token',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
    describe('authenticateTokenWithoutRefresh', () => {
        it('should return 401 when access token is missing', () => {
            mockRequest.cookies = {};
            (0, auth_1.authenticateTokenWithoutRefresh)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Access token required',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should authenticate user with valid token without refreshing', () => {
            const mockPayload = { userId: '123', email: 'test@example.com' };
            mockRequest.cookies = { accessToken: 'valid-token' };
            mockVerifyAccessToken.mockReturnValue(mockPayload);
            (0, auth_1.authenticateTokenWithoutRefresh)(mockRequest, mockResponse, mockNext);
            expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
            expect(mockRequest.user).toEqual(mockPayload);
            expect(mockGenerateAccessToken).not.toHaveBeenCalled();
            expect(mockResponse.cookie).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
        it('should return 403 when token is invalid', () => {
            mockRequest.cookies = { accessToken: 'invalid-token' };
            mockVerifyAccessToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            (0, auth_1.authenticateTokenWithoutRefresh)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid or expired access token',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
    describe('authorizeUserModification', () => {
        it('should return 401 when user is not authenticated', () => {
            mockRequest.user = undefined;
            mockRequest.params = { id: '123' };
            (0, auth_1.authorizeUserModification)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Authentication required',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should return 403 when user tries to modify another user', () => {
            mockRequest.user = { userId: '123', email: 'test@example.com' };
            mockRequest.params = { id: '456' };
            (0, auth_1.authorizeUserModification)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'You can only modify your own profile',
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should allow user to modify their own profile', () => {
            mockRequest.user = { userId: '123', email: 'test@example.com' };
            mockRequest.params = { id: '123' };
            (0, auth_1.authorizeUserModification)(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=auth.test.js.map