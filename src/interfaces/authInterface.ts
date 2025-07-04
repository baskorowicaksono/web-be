import { Request } from "express"

export interface JWTPayload {
    userId: string,
    email: string,
    tokenId: string,
    role: 'USER' | 'ADMIN',
    type: 'ACCESS' | 'TOKEN',
    iat?: number,
    exp?: number,
}

export interface AuthRequest extends Request {
    user?: {
        userId: string,
        email: string,
        tokenId: string,
        role: 'USER' | 'ADMIN',
    }
}