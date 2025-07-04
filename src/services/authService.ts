import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { JWTPayload } from "../interfaces/authInterface";
import bcrypt from 'bcryptjs';
import {v4 as uuidv4} from "uuid";
import { redisService } from "./redisService";

const prisma = new PrismaClient();

export const authService = {
    generateToken(userId: string, email: string, role: string){
        const accessTokenId = uuidv4();
        const refreshTokenId = uuidv4();

        const accessToken = jwt.sign(
            {
                data: { userId: userId, email: email, role: role, tokenId: accessTokenId, type: 'ACCESS' },
                exp: Number(process.env.ACCESS_TOKEN_EXPIRATION)
            },
            process.env.ACCESS_TOKEN_SECRET!,
        );

        const refreshToken = jwt.sign(
            {
                data: { userId: userId, email: email, role: role, tokenId: refreshTokenId, type: 'REFRESH' },
                exp: Number(process.env.REFRESH_TOKEN_EXPIRATION)
            },
            process.env.REFRESH_TOKEN_SECRET!,
        );

        return {accessToken, refreshToken};
    },

    decodeToken(token: string): JWTPayload {
        return jwt.decode(token) as JWTPayload;
    },

    getTokenExpiry(token: string): number | null {
    try {
        const decoded = this.decodeToken(token);
        return decoded.exp || null;
        } catch (error) {
        return null;
        }
    },

    isTokenExpired(token: string): boolean {
        const expiry = this.getTokenExpiry(token);
        return expiry ? Date.now() / 1000 > expiry : true;
    },

    async verifyToken(token: string, type: "ACCESS" | "REFRESH") {
        const secret = type === "ACCESS" ? process.env.ACCESS_TOKEN_SECRET! : process.env.REFRESH_TOKEN_SECRET!;
        const decodedToken = jwt.verify(token, secret) as JWTPayload;

        if(await redisService.isTokenBlacklisted(decodedToken.tokenId)){
            throw new Error("Token has been revoked");
        }

        const userBlacklistTime = await redisService.getUserBlacklistTime(decodedToken.userId);
        if(userBlacklistTime && decodedToken.iat && decodedToken.iat * 1000 < userBlacklistTime){
            throw new Error("Token has been revoked");
        }

        return decodedToken;
    },

    // Only register USER role, for admin role will be added manually on the DB
    async register(email: string, password: string, name?: string)  {
        const existingUser = await prisma.user.findUnique({where: {email}});
        if(existingUser){
            throw new Error("User already exists!");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email, hashed_password: hashedPassword, name: !name ? "TEST" : name, role: 'USER'},
            select: {id: true, email: true, name: true, role: true}
        })

        const token = this.generateToken(newUser.id, newUser.email, newUser.role);
        return {newUser, ...token};
    },

    async login(email: string, password: string) {
        const foundUser = await prisma.user.findUnique({where: {email}});
        if(!foundUser || !foundUser.isActive){
            throw new Error("Invalid Email!");
        }

        const isValidPassword = await bcrypt.compare(password, foundUser.hashed_password);
        if(!isValidPassword){
            throw new Error("Invalid Password!");
        }

        const token = this.generateToken(foundUser.id, foundUser.email, foundUser.role);
        return {
            user: { id: foundUser.id, email: foundUser.email, name: foundUser.name},
            ...token
        };
    },

    async refreshToken(refreshToken: string){
        const decodedToken = await this.verifyToken(refreshToken, "REFRESH");

        const refreshTokenExpiry = 7*24*60*60;
        await redisService.blacklistToken(decodedToken.tokenId, refreshTokenExpiry);

        const tokens = this.generateToken(decodedToken.userId, decodedToken.email, decodedToken.role);
        return {
            user: { id: decodedToken.userId, email: decodedToken.email},
            ...tokens
        };
    },

    async logout(token: string){
        try{
            const decodedToken = jwt.decode(token) as JWTPayload;
            if(decodedToken && decodedToken.tokenId && decodedToken.exp){
                const tokenExpiry = decodedToken.exp - Math.floor(Date.now()/1000);
                await redisService.blacklistToken(decodedToken.tokenId, tokenExpiry);
            }
        } catch(error){
            console.error(error);
        }
    },

    async logoutAll(userId: string){
        await redisService.blacklistAllUserTokens(userId);
    }
}