import { createClient } from "redis";

class RedisService{
    private client;

    constructor(){
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.client.on('error', (err) => console.log("Redis Client Error", err));
        this.connect();
    };

    private async connect(){
        await this.client.connect();
    }

    async blacklistToken(tokenId: string, expiresIn: number){
        await this.client.setEx(`blacklist:${tokenId}`, expiresIn, 'true');
    }

    async isTokenBlacklisted(tokenId: string): Promise<boolean> {
        const result = await this.client.get(`blacklist:${tokenId}`);
        return result === 'true';
    }

    async blacklistAllUserTokens(userId: string){
        const timestamp = Date.now();
        await this.client.set(`user_blacklist:${userId}`, timestamp.toString());
        return timestamp;
    }

    async getUserBlacklistTime(userId: string): Promise<number | null>{
        const result = await this.client.get(`user_blacklist:${userId}`);
        return result ? parseInt(result) : null;
    }

    async clearUserBlacklist(userId: string){
        await this.client.del(`user_blacklist:${userId}`);
    }
}

export const redisService = new RedisService();