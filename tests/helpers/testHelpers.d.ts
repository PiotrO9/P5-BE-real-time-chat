import { TokenPayload } from '../../src/utils/jwt';
export interface TestUser {
    id: string;
    email: string;
    username: string;
    password: string;
}
export declare function createTestUser(data?: {
    email?: string;
    username?: string;
    password?: string;
}): Promise<TestUser>;
export declare function generateTestToken(payload: TokenPayload): string;
export declare function createAuthHeaders(userId: string, email: string): {
    Cookie: string;
};
//# sourceMappingURL=testHelpers.d.ts.map