export interface JWTPayload {
    userId: string,
    email: string,
    tokenId: string,
    role: 'USER' | 'ADMIN',
    type: 'ACCESS' | 'TOKEN',
    iat?: number | undefined,
    exp?: number | undefined,
}

export interface AuthRequest extends Request {
    user?: {
        userId: string,
        email: string,
        role: 'USER' | 'ADMIN',
    }
}